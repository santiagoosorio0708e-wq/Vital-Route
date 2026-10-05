-- database/procedures.sql

USE vitalroute;

DELIMITER //

-- ==========================================
-- STORED PROCEDURE: Asignar Recurso a Emergencia (ALTA CONCURRENCIA)
-- ==========================================
-- Utiliza Pessimistic Locking estricto y maneja excepciones transaccionales
-- mediante Exit Handlers. Valida disponibilidad y registra en el historial.
CREATE PROCEDURE assign_resource_to_emergency(
    IN p_emergency_id CHAR(36),
    IN p_clinic_id INT,
    IN p_resource_id INT,
    IN p_operator VARCHAR(255)
)
BEGIN
    DECLARE v_current_qty INT;
    DECLARE v_current_status VARCHAR(50);
    
    -- Handler de excepciones transaccionales para prevenir fugas de conexión
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
        ROLLBACK;
        RESIGNAL; -- Relanzar el error al orquestador (Node.js/Python)
    END;

    -- Iniciar transacción con aislamiento estricto
    START TRANSACTION;

    -- 1. Validar estado de la emergencia
    SELECT status INTO v_current_status 
    FROM emergencies 
    WHERE id = p_emergency_id 
    FOR UPDATE;

    IF v_current_status = 'resolved' OR v_current_status = 'cancelled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Operación Denegada: La emergencia ya fue resuelta o cancelada.';
    END IF;

    -- 2. Bloquear la fila de inventario (Pessimistic Locking)
    SELECT quantity INTO v_current_qty 
    FROM clinic_inventory 
    WHERE clinic_id = p_clinic_id AND resource_id = p_resource_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Datos Inválidos: La clínica especificada no gestiona este recurso.';
    END IF;

    IF v_current_qty > 0 THEN
        -- 3. Reducir el inventario de forma segura
        UPDATE clinic_inventory 
        SET quantity = quantity - 1 
        WHERE clinic_id = p_clinic_id AND resource_id = p_resource_id;

        -- 4. Actualizar el estado de la emergencia
        UPDATE emergencies 
        SET assigned_clinic_id = p_clinic_id, status = 'en_route', updated_at = CURRENT_TIMESTAMP
        WHERE id = p_emergency_id;

        -- 5. Registrar el cambio en la tabla de trazabilidad médica
        INSERT INTO emergency_status_history (emergency_id, previous_status, new_status, changed_by, notes)
        VALUES (p_emergency_id, v_current_status, 'en_route', p_operator, CONCAT('Recurso crítico asignado en clínica ID: ', p_clinic_id));

        COMMIT;
    ELSE
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Concurrency Collision: Recurso crítico agotado debido a una asignación simultánea externa.';
    END IF;
END //


-- ==========================================
-- STORED PROCEDURE: Cálculo Espacial de Clínicas (Core Predictivo en DB)
-- ==========================================
-- Encuentra y ordena clínicas cercanas basándose en la Fórmula de Haversine nativa de MySQL.
CREATE PROCEDURE find_nearest_clinics_with_availability(
    IN p_lat DECIMAL(10,8),
    IN p_lng DECIMAL(11,8),
    IN p_resource_id INT,
    IN p_radius_km INT
)
BEGIN
    DECLARE v_origin POINT;
    -- Crear punto geoespacial asegurando SRID 4326 (Sistema Mundial estándar GPS)
    SET v_origin = ST_GeomFromText(CONCAT('POINT(', p_lng, ' ', p_lat, ')'), 4326);

    SELECT 
        c.id, 
        c.name, 
        c.capacity_level,
        ci.quantity AS available_resources,
        -- Cálculo de distancia en Metros convertido a KM
        ST_Distance_Sphere(c.location, v_origin) / 1000 AS distance_km
    FROM clinics c
    INNER JOIN clinic_inventory ci ON c.id = ci.clinic_id
    WHERE ci.resource_id = p_resource_id
      AND ci.quantity > 0
      AND c.status = 'active'
    HAVING distance_km <= p_radius_km
    ORDER BY distance_km ASC;
END //


-- ==========================================
-- TRIGGER: Prevenir Inventario Negativo (Integridad Fuerte ETL)
-- ==========================================
CREATE TRIGGER trg_clinic_inventory_before_update
BEFORE UPDATE ON clinic_inventory
FOR EACH ROW
BEGIN
    -- Bloquear números negativos provenientes del script Python/ETL
    IF NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Data Integrity Error: El inventario de recursos no puede ser inferior a cero.';
    END IF;
    
    -- Autocorrección si el sistema legado (clínica remota) reporta más de lo que la capacidad permite
    IF NEW.quantity > NEW.capacity THEN
        SET NEW.quantity = NEW.capacity; 
    END IF;
END //


-- ==========================================
-- TRIGGER: Auditoría en Tiempo Real con formato JSON (Loggear cambios)
-- ==========================================
CREATE TRIGGER trg_clinic_inventory_after_update
AFTER UPDATE ON clinic_inventory
FOR EACH ROW
BEGIN
    IF OLD.quantity != NEW.quantity THEN
        -- Almacenar la foto exacta de la base de datos para auditorías médicas legales
        INSERT INTO audit_logs (table_name, record_id, action, old_value, new_value)
        VALUES (
            'clinic_inventory', 
            CONCAT(NEW.clinic_id, '-', NEW.resource_id), 
            'UPDATE', 
            JSON_OBJECT('quantity', OLD.quantity, 'capacity', OLD.capacity), 
            JSON_OBJECT('quantity', NEW.quantity, 'capacity', NEW.capacity)
        );
    END IF;
END //


-- ==========================================
-- TRIGGER: Máquina de Estados para Trazabilidad de Emergencias
-- ==========================================
CREATE TRIGGER trg_emergencies_after_update
AFTER UPDATE ON emergencies
FOR EACH ROW
BEGIN
    -- Capturar automáticamente cualquier cambio de estado que no haya pasado por el Stored Procedure
    IF OLD.status != NEW.status AND NEW.status != 'en_route' THEN
        INSERT INTO emergency_status_history (emergency_id, previous_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, 'system_trigger');
    END IF;
END //

DELIMITER ;
