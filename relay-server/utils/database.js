import Database from 'better-sqlite3';

const db = new Database('educacion.db');

// Inicializar la base de datos con datos de ejemplo
db.exec(`
  CREATE TABLE IF NOT EXISTS estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    edad INTEGER NOT NULL,
    grado TEXT NOT NULL,
    correo TEXT
  );

  -- Agregar datos de ejemplo si la tabla está vacía
  INSERT OR IGNORE INTO estudiantes (nombre, edad, grado, correo)
  SELECT * FROM (
    SELECT 'Juan Pérez', 16, '4º ESO', 'juan@ejemplo.com'
    UNION SELECT 'María García', 15, '3º ESO', 'maria@ejemplo.com'
    UNION SELECT 'Roberto Martínez', 17, '1º Bachillerato', 'roberto@ejemplo.com'
    UNION SELECT 'Ana López', 14, '2º ESO', 'ana@ejemplo.com'
    UNION SELECT 'Carlos Rodríguez', 16, '4º ESO', 'carlos@ejemplo.com'
  ) WHERE NOT EXISTS (SELECT 1 FROM estudiantes);
`);

export function executeQuery(query) {
  try {
    const stmt = db.prepare(query);
    const isSelect = query.trim().toLowerCase().startsWith('select');
    
    if (isSelect) {
      const results = stmt.all();
      return {
        success: true,
        data: results,
        message: `Consulta ejecutada exitosamente. Se encontraron ${results.length} registros.`
      };
    } else {
      const result = stmt.run();
      return {
        success: true,
        data: result,
        message: `Consulta ejecutada exitosamente. Se afectaron ${result.changes} filas.`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Error al ejecutar la consulta'
    };
  }
} 