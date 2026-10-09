-- database/init.sql
-- Motor MySQL 8.0+ Requerido para Funciones Geoespaciales y JSON

CREATE DATABASE IF NOT EXISTS vitalroute
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE vitalroute;

-- ==========================================
-- 1. TABLAS DE CATÁLOGO Y CONFIGURACIÓN
-- ==========================================

-- Tabla de tipos de recursos médicos para mayor extensibilidad
CREATE TABLE IF NOT EXISTS resource_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    priority_level INT NOT NULL DEFAULT 1 COMMENT 'Nivel de prioridad en triage (1 mayor)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo de recursos médicos críticos
CREATE TABLE IF NOT EXISTS resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_critical BOOLEAN DEFAULT TRUE COMMENT 'Indica si requiere monitoreo estricto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES resource_categories(id)
) ENGINE=InnoDB;

-- ==========================================
-- 2. INFRAESTRUCTURA HOSPITALARIA
-- ==========================================

-- Clínicas y Hospitales de la red
CREATE TABLE IF NOT EXISTS clinics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location POINT NOT NULL SRID 4326 COMMENT 'Coordenadas Geoespaciales (Longitud, Latitud)',
    address VARCHAR(500),
    contact_phone VARCHAR(50),
    capacity_level ENUM('Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4') NOT NULL,
    status ENUM('active', 'inactive', 'saturated') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    SPATIAL INDEX idx_location (location)
) ENGINE=InnoDB;

-- Inventario de recursos por clínica (relación N:M transaccional)
CREATE TABLE IF NOT EXISTS clinic_inventory (
    clinic_id INT,
    resource_id INT,
    quantity INT NOT NULL DEFAULT 0,
    capacity INT NOT NULL DEFAULT 0 COMMENT 'Capacidad máxima de este recurso en la clínica',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (clinic_id, resource_id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 3. GESTIÓN DE EMERGENCIAS Y TRIAJE
-- ==========================================

CREATE TABLE IF NOT EXISTS emergencies (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID para evitar enumeración y mayor seguridad',
    patient_name VARCHAR(255) NOT NULL,
    patient_identifier VARCHAR(100) NULL COMMENT 'Documento o ID anonimizado en hash',
    triage_score DECIMAL(5, 2) NULL COMMENT 'Puntaje matemático calculado por el agente IA',
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    required_resource_id INT NULL,
    origin_location POINT NULL SRID 4326 COMMENT 'Ubicación desde donde se reporta la emergencia',
    assigned_clinic_id INT NULL,
    status ENUM('pending', 'evaluating', 'en_route', 'admitted', 'resolved', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (required_resource_id) REFERENCES resources(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_clinic_id) REFERENCES clinics(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Historial de estado de emergencias (Para trazabilidad y analítica de tiempos de respuesta)
CREATE TABLE IF NOT EXISTS emergency_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    emergency_id CHAR(36) NOT NULL,
    previous_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255) DEFAULT 'system',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 4. AUDITORÍA (SEGURIDAD Y CUMPLIMIENTO)
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255) DEFAULT 'system'
) ENGINE=InnoDB;

-- ==========================================
-- 5. DATOS SEMILLA (SIMULACIÓN DE CLÍNICAS)
-- ==========================================
INSERT INTO resource_categories (id, name, priority_level) VALUES 
(1, 'Cuidados Intensivos (UCI)', 1),
(2, 'Banco de Sangre', 1),
(3, 'Equipamiento de Soporte Vital', 2),
(4, 'Camas de Hospitalización', 3);

-- El recurso 4 corresponde a la categoría 4 (Camas de Hospitalización) y es
-- el que el motor de triaje asigna a los casos de gravedad media y baja.
-- Sin él, esos casos fallaban por llave foránea al registrar la emergencia.
INSERT INTO resources (id, category_id, name, description, is_critical) VALUES
(1, 1, 'Cama UCI Adulto', 'Unidad de cuidados intensivos completamente equipada', TRUE),
(2, 2, 'Sangre O Negativo', 'Unidad de sangre universal', TRUE),
(3, 3, 'Respirador Artificial Portátil', 'Ventilador mecánico para traslado', TRUE),
(4, 4, 'Cama General de Hospitalización', 'Cama de hospitalización para pacientes sin criterio de ingreso a UCI', FALSE);

-- Insertamos clínicas de Ciudad de México (CDMX).
-- Las coordenadas van en orden longitud-latitud, que es como las entrega el
-- GPS y como las usa el resto del sistema. MySQL, con SRID 4326, asume el
-- orden contrario, asi que hay que decirselo con 'axis-order=long-lat'. Sin
-- esa opcion rechaza la longitud de CDMX (-99) por estar fuera del rango de
-- latitudes validas, y la carga del esquema se detiene ahi.
INSERT INTO clinics (id, name, location, address, capacity_level) VALUES 
(1, 'Hospital General de México Dr. Eduardo Liceaga', ST_GeomFromText('POINT(-99.1517 19.4128)', 4326, 'axis-order=long-lat'), 'Dr. Balmis 148, Doctores, Cuauhtémoc, CDMX', 'Nivel 4'),
(2, 'Centro Médico Nacional Siglo XXI', ST_GeomFromText('POINT(-99.1543 19.4074)', 4326, 'axis-order=long-lat'), 'Av. Cuauhtémoc 330, Doctores, Cuauhtémoc, CDMX', 'Nivel 4'),
(3, 'Hospital Juárez de México', ST_GeomFromText('POINT(-99.1362 19.4827)', 4326, 'axis-order=long-lat'), 'Av. Instituto Politécnico Nacional 5160, Magdalena de las Salinas, CDMX', 'Nivel 3');

-- Las camas generales (recurso 4) son muchas más que las de UCI, por eso las
-- cantidades son de otro orden. El Hospital Juárez es Nivel 3 y por eso tiene
-- menos que los dos de Nivel 4.
INSERT INTO clinic_inventory (clinic_id, resource_id, quantity, capacity) VALUES
(1, 1, 15, 50), (1, 2, 30, 100), (1, 3, 10, 25), (1, 4, 120, 450),
(2, 1, 20, 60), (2, 2, 45, 120), (2, 3, 15, 30), (2, 4, 95, 380),
(3, 1, 5, 20), (3, 2, 15, 40), (3, 3, 4, 15), (3, 4, 40, 160);
