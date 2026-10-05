import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

# Cargar variables de entorno (asumimos que .env está dos niveles arriba o se pasa en entorno)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

class DatabaseLoader:
    """
    Carga los datos normalizados a la Base de Datos Central usando 
    transacciones atómicas para garantizar integridad.
    """
    def __init__(self):
        self.host = os.getenv("DB_HOST", "127.0.0.1")
        self.user = os.getenv("DB_USER", "root")
        self.password = os.getenv("DB_PASSWORD", "")
        self.database = os.getenv("DB_NAME", "vitalroute")
        self.port = os.getenv("DB_PORT", "3306")

    def get_connection(self):
        try:
            return mysql.connector.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database
            )
        except Error as e:
            print(f"[CRITICAL ERROR] Fallo conectando a MySQL CDMX: {e}")
            return None

    def upsert_inventory(self, normalized_data):
        """
        Ejecuta actualización masiva segura del inventario.
        Utiliza el trigger prevent_negative_inventory de la base de datos como escudo.
        """
        conn = self.get_connection()
        if not conn:
            return False

        try:
            cursor = conn.cursor()
            # Desactivamos el autocommit para manejar la transacción de forma global (ACID)
            conn.autocommit = False

            update_query = """
                UPDATE clinic_inventory 
                SET quantity = %s 
                WHERE clinic_id = %s AND resource_id = %s
            """

            # Preparamos los parámetros (quantity, clinic_id, resource_id)
            update_data = [(item['quantity'], item['clinic_id'], item['resource_id']) for item in normalized_data]
            
            # executemany permite alto rendimiento (Bulk update)
            cursor.executemany(update_query, update_data)
            
            # Confirmamos los cambios. 
            # NOTA: Los Triggers SQL que diseñamos previamente se dispararán automáticamente 
            # loggeando las auditorías JSON en la tabla `audit_logs` de forma pasiva.
            conn.commit()
            print(f"[ETL LOADER] ✅ Sincronización exitosa. {cursor.rowcount} registros de inventario actualizados.")
            return True

        except Error as e:
            print(f"[ETL LOADER] 🚨 Error SQL Transaccional. Ejecutando ROLLBACK de emergencia: {e}")
            conn.rollback()
            return False
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
