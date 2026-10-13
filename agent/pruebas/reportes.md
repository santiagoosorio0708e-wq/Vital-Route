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

Signos vitales casi normales, sin peligro inmediato. Este caso fue el que
destapo el error del recurso 4, ya corregido en `database/init.sql`.

```
Hombre de 60 anos, paciente Ramon Cortes, se cayo en la escalera del metro Pino Suarez y le duele la cadera. Esta consciente y habla normal. Pulso 96, presion 128, oxigeno 95. lat 19.4260 lon -99.1330
```

Lo que se mira: una ambulancia asignada y una gravedad baja o media. En modo
simulacro la gravedad sale fija en `high`; hace falta el motor de Python
conectado. Con el motor real sale `low`, puntaje 0: el triaje solo mira pulso,
presion y oxigeno, y no la edad ni el mecanismo de la lesion.

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

Corrida del 11 de octubre de 2026, modelo `grok-4.6`, sistema completo (core
de Python y MySQL).

| Caso | Pasos | Entrada | Salida | Costo USD | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 Critico | 2 | 2747 | 421 | 0.007476 | critical, puntaje 20, AMB-01, Hospital General, 1.31 km |
| 2 Medio | 2 | 2793 | 438 | 0.007625 | low, puntaje 0, AMB-05, Hospital General, 2.45 km |
| 3 Incompleto | 1 | 1289 | 569 | 0.004385 | No despacho, pidio los signos que faltaban |

Promedio: USD 0.0065 por tarea.

La salida incluye los tokens de razonamiento, que se cobran pero no aparecen
en `completion_tokens`. Se notan porque `total_tokens` es mayor que la suma de
entrada y salida. En el caso 3 el razonamiento fue casi toda la salida: 546 de
569, porque el modelo gasto el esfuerzo en decidir que no tenia con que
despachar.

El agente imprime estos valores al final de cada corrida, en el bloque
`Resumen de la tarea`. Con el modelo falso los tokens salen en cero.
