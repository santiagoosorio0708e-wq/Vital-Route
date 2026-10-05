CREATE DATABASE IF NOT EXISTS vitalroute;
USE vitalroute;

-- Clínicas y Hospitales de la red
CREATE TABLE IF NOT EXISTS clinics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo de recursos médicos críticos
CREATE TABLE IF NOT EXISTS resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category ENUM('bed_uci', 'blood', 'equipment', 'general_bed') NOT NULL,
    description TEXT
);

-- Inventario de recursos por clínica (relación N:M transaccional)
CREATE TABLE IF NOT EXISTS clinic_inventory (
    clinic_id INT,
    resource_id INT,
    quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (clinic_id, resource_id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- Registro de Emergencias y Triaje
CREATE TABLE IF NOT EXISTS emergencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    required_resource_id INT,
    assigned_clinic_id INT NULL,
    status ENUM('pending', 'en_route', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (required_resource_id) REFERENCES resources(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_clinic_id) REFERENCES clinics(id) ON DELETE SET NULL
);

-- ==========================================
-- DATOS SEMILLA (SIMULACIÓN DE CLÍNICAS)
-- ==========================================
INSERT INTO resources (name, category) VALUES 
('Cama UCI', 'bed_uci'),
('Sangre O-', 'blood'),
('Respirador Artificial', 'equipment');

INSERT INTO clinics (name, location_lat, location_lng) VALUES 
('Hospital Central', 4.6097, -74.0817),
('Clínica del Norte', 4.6534, -74.0556);

INSERT INTO clinic_inventory (clinic_id, resource_id, quantity) VALUES 
(1, 1, 5), (1, 2, 10), (1, 3, 2),
(2, 1, 0), (2, 2, 5), (2, 3, 1);
