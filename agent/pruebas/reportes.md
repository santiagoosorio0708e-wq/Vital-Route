# Reportes de prueba del Sprint 1

Tres llamadas de emergencia escritas como las dictaria un operador telefonico.
Sirven para la demostracion y para la tabla de costo por tarea del reporte.

Se corren todas en fila con:

```sh
cd agent
./pruebas/correr.sh
```

---

## Caso 1 - Critico

Signos vitales muy malos. Deberia salir gravedad `critical` y la ambulancia
mas cercana.

```
Mujer joven, paciente Ana Reyes, atropellada en Avenida Chapultepec. Esta inconsciente y sangra por la cabeza. Pulso 138, presion 78, oxigeno 81. lat 19.4195 lon -99.1620
```

Lo que se mira: gravedad `critical`, una ambulancia asignada, un hospital con
la distancia en kilometros, y en la terminal del gateway las dos lineas de
tiempo real (`[despacho]` y `[alerta]`).

---

## Caso 2 - Gravedad media

Signos vitales fuera de rango pero sin peligro inmediato. Aqui es donde se
destapa el error del recurso 4 si todavia no lo han corregido en
`core/app/triage_engine.py`.

```
Hombre de 60 anos, paciente Ramon Cortes, se cayo en la escalera del metro Pino Suarez y le duele la cadera. Esta consciente y habla normal. Pulso 96, presion 128, oxigeno 95. lat 19.4260 lon -99.1330
```

Lo que se mira: gravedad `medium`. Ojo, en modo simulacro la gravedad sale
fija en `high` y el bug no se destapa; hace falta el motor de Python
conectado. Con el bug sin corregir, esto devuelve un error 500 por llave
foranea, y el agente lo reporta en lugar de romperse. Esa reaccion tambien
vale para el video.

---

## Caso 3 - Datos incompletos

Falta la presion arterial y no hay coordenadas. Sirve para ver si el modelo
pregunta, asume o despacha de todos modos.

```
Llaman del mercado de Coyoacan. Una senora mayor se desmayo en un pasillo. Respira con dificultad y tiene el oxigeno en 88. No sabemos la presion. No nos dieron direccion exacta.
```

Lo que se mira: el modelo deberia pedir la informacion que falta en lugar de
inventarla.

Resultado de la corrida real: Grok no llamo la herramienta y respondio
"Faltan signos vitales. Necesito el pulso y la presion sistolica. No despacho
hasta tenerlos." El modelo falso, con este mismo texto, invento coordenadas y
despacho a "Paciente sin identificar".

---

## Resultados con Grok real

Corrida del 9 de octubre de 2026, modelo `grok-4.6`, gateway en modo
simulacro.

| Caso | Pasos | Entrada | Salida | Costo USD | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 Critico | 2 | 2750 | 370 | 0.0074 | AMB-04, Hospital General, 1.31 km |
| 2 Medio | 2 | 2778 | 539 | 0.0078 | AMB-05, Hospital General, 2.45 km |
| 3 Incompleto | 1 | 1289 | 734 | 0.0048 | No despacho, pidio los signos que faltaban |

Suma: USD 0.0200. El panel del reto paso de 0.02 a 0.04 dolares gastados con
estas tres tareas, asi que la cuenta cuadra al centavo.

La salida incluye los tokens de razonamiento, que se cobran pero no aparecen
en `completion_tokens`. Se notan porque `total_tokens` es mayor que la suma de
entrada y salida. En el caso 3 el razonamiento fue casi toda la salida: 708 de
734, porque el modelo gasto el esfuerzo en decidir que no tenia con que
despachar.

El agente imprime estos valores al final de cada corrida, en el bloque
`Resumen de la tarea`. Con el modelo falso los tokens salen en cero.
