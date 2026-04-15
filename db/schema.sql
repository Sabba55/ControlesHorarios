-- rtcs/db/schema.sql
-- Modelo de datos completo del Rally Time Control System.
-- Ejecutar este archivo UNA SOLA VEZ para crear las tablas en la base de datos.
-- Requiere que la base de datos `rtcs_db` ya exista en PostgreSQL.
--
-- Crear la base de datos (desde psql o pgAdmin):
--   CREATE DATABASE rtcs_db;
-- Luego ejecutar este archivo:
--   psql -U postgres -d rtcs_db -f schema.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Limpiar tablas anteriores (útil para resetear en desarrollo)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS registros_tiempos CASCADE;
DROP TABLE IF EXISTS cronograma        CASCADE;
DROP TABLE IF EXISTS vehiculos         CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de Vehículos
-- Almacena los participantes de la competencia.
-- El número de competidor es la clave primaria (ej: 1, 7, 14, 101).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE vehiculos (
    numero    INTEGER      PRIMARY KEY,
    piloto    VARCHAR(100) NOT NULL,
    navegante VARCHAR(100),                  -- Opcional: puede competir solo
    categoria VARCHAR(50)  NOT NULL          -- Ej: RC1, RC2, RC3, GENERAL
);

COMMENT ON TABLE  vehiculos           IS 'Participantes de la competencia de rally.';
COMMENT ON COLUMN vehiculos.numero    IS 'Número de competidor (clave primaria).';
COMMENT ON COLUMN vehiculos.categoria IS 'Categoría del vehículo: RC1, RC2, RC3, RC4, RC5, GENERAL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla de Cronograma (Itinerario)
-- Define todos los puntos de control del rally en orden.
-- tipos: CH (Control Horario), PE (Prueba Especial), FLEXI (Flexi-Service),
--        ASISTENCIA, REGRUP (Reagrupamiento).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE cronograma (
    id                   SERIAL       PRIMARY KEY,
    nombre               VARCHAR(50)  NOT NULL,       -- Ej: 'CH 0', 'PE 1', 'Flexi A'
    tipo                 VARCHAR(20)  NOT NULL
                         CHECK (tipo IN ('CH', 'PE', 'FLEXI', 'ASISTENCIA', 'REGRUP')),
    tiempo_enlace        INTEGER      NOT NULL DEFAULT 0,   -- Minutos entre puntos
    no_penaliza_adelanto BOOLEAN      NOT NULL DEFAULT FALSE, -- TRUE para CH 7E, CH 13A, etc.
    orden                INTEGER      NOT NULL UNIQUE        -- Posición en el itinerario
);

COMMENT ON TABLE  cronograma                       IS 'Itinerario completo de la competencia.';
COMMENT ON COLUMN cronograma.nombre                IS 'Nombre del punto. Ej: CH 0, PE 1A, Flexi A.';
COMMENT ON COLUMN cronograma.tipo                  IS 'Tipo de punto: CH, PE, FLEXI, ASISTENCIA, REGRUP.';
COMMENT ON COLUMN cronograma.tiempo_enlace         IS 'Minutos otorgados para llegar desde el punto anterior.';
COMMENT ON COLUMN cronograma.no_penaliza_adelanto  IS 'Si es TRUE, llegar antes no es falta (fin de etapa).';
COMMENT ON COLUMN cronograma.orden                 IS 'Posición en el itinerario. Debe ser único.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla de Registros de Tiempos
-- Cruce entre vehículos y cronograma.
-- Almacena la hora_ideal calculada y la hora_real ingresada por el control.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE registros_tiempos (
    vehiculo_id   INTEGER REFERENCES vehiculos(numero)  ON DELETE CASCADE,
    cronograma_id INTEGER REFERENCES cronograma(id)     ON DELETE CASCADE,
    hora_ideal    TIME,    -- Calculada automáticamente por el sistema
    hora_real     TIME,    -- Ingresada manualmente por el juez de control
    PRIMARY KEY (vehiculo_id, cronograma_id)
);

COMMENT ON TABLE  registros_tiempos             IS 'Cruce de vehículos × puntos del cronograma con tiempos.';
COMMENT ON COLUMN registros_tiempos.hora_ideal  IS 'Hora en que el vehículo debería llegar según el itinerario.';
COMMENT ON COLUMN registros_tiempos.hora_real   IS 'Hora en que el vehículo llegó realmente al control.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices para mejorar performance en las queries de la grilla
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_registros_vehiculo   ON registros_tiempos (vehiculo_id);
CREATE INDEX idx_registros_cronograma ON registros_tiempos (cronograma_id);
CREATE INDEX idx_cronograma_orden     ON cronograma (orden);