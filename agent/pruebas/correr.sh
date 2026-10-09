#!/usr/bin/env bash
#
# Corre los tres reportes de prueba del Sprint 1, uno tras otro.
#
# Antes de correrlo hay que tener el gateway arriba:
#   cd api && npm run dev
#
# Uso:
#   cd agent
#   ./pruebas/correr.sh
#
# Los textos de los tres casos estan explicados en pruebas/reportes.md

set -u

cd "$(dirname "$0")/.."

CRITICO="Mujer joven, paciente Ana Reyes, atropellada en Avenida Chapultepec. Esta inconsciente y sangra por la cabeza. Pulso 138, presion 78, oxigeno 81. lat 19.4195 lon -99.1620"

MEDIO="Hombre de 60 anos, paciente Ramon Cortes, se cayo en la escalera del metro Pino Suarez y le duele la cadera. Esta consciente y habla normal. Pulso 96, presion 128, oxigeno 95. lat 19.4260 lon -99.1330"

INCOMPLETO="Llaman del mercado de Coyoacan. Una senora mayor se desmayo en un pasillo. Respira con dificultad y tiene el oxigeno en 88. No sabemos la presion. No nos dieron direccion exacta."

correr() {
  echo
  echo "################################################################"
  echo "# CASO $1"
  echo "################################################################"
  npm run dev --silent -- "$2"
  echo
  echo "(fin del caso $1)"
}

correr "1 - CRITICO" "$CRITICO"
correr "2 - GRAVEDAD MEDIA" "$MEDIO"
correr "3 - DATOS INCOMPLETOS" "$INCOMPLETO"

echo
echo "Listo. Copia los valores de 'Resumen de la tarea' de cada caso a la"
echo "tabla de pruebas/reportes.md y al reporte tecnico."
