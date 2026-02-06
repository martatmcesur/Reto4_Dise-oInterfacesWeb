//Importamos librería better-sqlite3 y la guardamos en la variable Database
//Es lo que nos permite ejecutar SQL (SELECT,INSERT...)
const Database = require('better-sqlite3');

//Con esa variable creamos conexion a la base de datos
const db = new Database('videojuegos.db');

//db.exec ejecuta las isntrucciones que le pasamos 
//Si no existe crea una tabla con las siguientes características:
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    genre TEXT NOT NULL,
    status TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

//Crear usuario por defecto si no existe (id = 1)
const userExists = db.prepare('SELECT id FROM users WHERE id = 1').get();

if (!userExists) {
  db.prepare(`
    INSERT INTO users (id, username, password)
    VALUES (1, 'demo', 'demo')
  `).run();
}


module.exports = db;
