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

Lo que se mira: gravedad `medium`. Con el motor de Python conectado y el bug
sin corregir, esto devuelve un error 500 por llave foranea, y el agente lo
reporta en lugar de romperse. Esa reaccion tambien vale para el video.

---

## Caso 3 - Datos incompletos

Falta la presion arterial y no hay coordenadas. Sirve para ver si el modelo
pregunta, asume o despacha de todos modos.

```
Llaman del mercado de Coyoacan. Una senora mayor se desmayo en un pasillo. Respira con dificultad y tiene el oxigeno en 88. No sabemos la presion. No nos dieron direccion exacta.
```

Lo que se mira: el modelo deberia pedir la informacion que falta en lugar de
inventarla. Si inventa coordenadas o signos vitales, hay que ajustar las
instrucciones en `agent/src/core/prompt.ts` y anotarlo en el reporte.

---

## Tabla para llenar con la corrida real

| Caso | Pasos | Tokens entrada | Tokens salida | Costo USD | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 Critico | | | | | |
| 2 Medio | | | | | |
| 3 Incompleto | | | | | |

El agente imprime estos cuatro valores al final de cada corrida, en el bloque
`Resumen de la tarea`. Con el modelo falso los tokens salen en cero, asi que
la tabla solo se llena con Grok real.
