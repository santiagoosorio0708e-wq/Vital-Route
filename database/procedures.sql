USE vitalroute;

DELIMITER //

-- ==========================================
-- STORED PROCEDURE: Asignar Recurso a Emergencia
-- ==========================================
-- Este procedimiento usa "Pessimistic Locking" (FOR UPDATE) para 
-- evitar colisiones de concurrencia cuando dos emergencias 
-- intentan tomar el último recurso simultáneamente.
CREATE PROCEDURE assign_resource_to_emergency(
    IN p_emergency_id INT,
    IN p_clinic_id INT,
    IN p_resource_id INT
)
BEGIN
    DECLARE current_qty INT;

    -- Iniciar transacción para garantizar ACID
    START TRANSACTION;

    -- Bloquear la fila de inventario para lectura/escritura concurrente
    SELECT quantity INTO current_qty 
    FROM clinic_inventory 
    WHERE clinic_id = p_clinic_id AND resource_id = p_resource_id
    FOR UPDATE;

    IF current_qty > 0 THEN
        -- Reducir el inventario de forma segura
        UPDATE clinic_inventory 
        SET quantity = quantity - 1 
        WHERE clinic_id = p_clinic_id AND resource_id = p_resource_id;

        -- Actualizar el estado de la emergencia
        UPDATE emergencies 
        SET assigned_clinic_id = p_clinic_id, status = 'en_route' 
        WHERE id = p_emergency_id;

        -- Confirmar la transacción
        COMMIT;
    ELSE
        -- Revertir y lanzar error si no hay inventario
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Concurrency Error: Recurso agotado o no disponible en esta clínica al momento de la asignación.';
    END IF;

END //


-- ==========================================
-- TRIGGER: Prevenir Inventario Negativo
-- ==========================================
-- Garantiza que a nivel de base de datos NUNCA una actualización 
-- del middleware ETL permita que los recursos críticos sean menores a cero.
CREATE TRIGGER trg_prevent_negative_inventory
BEFORE UPDATE ON clinic_inventory
FOR EACH ROW
BEGIN
    IF NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integridad Referencial: El inventario de un recurso crítico (UCI, Sangre) no puede ser menor a cero.';
    END IF;
END //

DELIMITER ;
