
//--------IMPORTS(todas las librerias y archivos que necesita el servidor)-----


//El framework que usamos para crear el servidor HTTP y definir rutas

//Para poder usar layouts con .ejs (plantillas base) para no repetir HTML en cada vista
const expressLayouts = require('express-ejs-layouts');

//Require sirve para importar código de otros archivos del proyecto.
//Carga lo que exporta db.js y se gguarda en la variable db.
const db = require('./db');

//Crea la app. Un objeto al que se le dicen las rutas, qué configuraciones usa, que middlewares usa...
//app.post, app.get, app.listen...
const app = express();

//Puerto por el que escucha
const PORT = 3000;

//express-session gestiona sesiones de usuario en el servidor
//(sirve para recordar qué usuario está logueado entre peticiones).
const session = require('express-session');


//-------- VISTAS, MIDDLEWARES Y SESIONES -----

// Indicamos que el motor de plantillas es EJS (archivos .ejs)
app.set('view engine', 'ejs');
// Carpeta donde se encuentran las vistas (plantillas EJS).
app.set('views', __dirname + '/views');
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'un-secreto-super-seguro',
  resave: false,
  saveUninitialized: false
}));

//PASAR QUERY A VISTAS 
app.use((req, res, next) => {
  res.locals.query = req.query;
  next();
});

//Middleware para pasar el nombre de usuario logueado a todas las vistas
//Si no hay usuario en sesión, será undefined
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  next();
});

//-------- MIDDLEWARE DE AUTENTICACIÓN --------

//Proteger rutas privadas
//Si no hay userId en la sesión, redirige al formulario de login.
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}


//-------- RUTAS --------

app.get('/', requireLogin, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='pendiente' THEN 1 ELSE 0 END) as pendientes,
      SUM(CASE WHEN status='jugando' THEN 1 ELSE 0 END) as jugando,
      SUM(CASE WHEN status='completado' THEN 1 ELSE 0 END) as completados
    FROM games WHERE user_id = ?
  `).get(req.session.userId);
  
  res.render('index', { stats });
});

//-------- AUTENTICACIÓN: LOGIN / LOGOUT / REGISTER --------


app.get('/login', (req, res) => {
  res.render('login');
});

//Procesar el envío del formulario de login
//Busca un usuario con ese username y password en la tabla users
//Si existe, guarda su id y username en la sesión y redirige a /videojuegos
//Si no, vuelve a mostrar el login con un mensaje de error
app.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  const stmt = db.prepare(`
    SELECT * FROM users
    WHERE username = ? AND password = ?
  `);

  const user = stmt.get(usuario, password);

  if (!user) {
  
    return res.render('login', { error: 'Usuario o contraseña incorrectos' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.redirect('/videojuegos');
});


//-------- CRUD DE VIDEOJUEGOS --------

//LISTAR videojuegos desde la BD (usuario logueado).
//Esta es la página principal de la lista de juegos.
app.get('/videojuegos', requireLogin, (req, res) => {
 let querySQL = 'SELECT * FROM games WHERE user_id = ?';
  let params = [req.session.userId];
  
  if (req.query.platform) {
     querySQL += ' AND platform LIKE ?';
    params.push(`%${req.query.platform}%`);
  }
  if (req.query.genre) {
    querySQL += ' AND genre LIKE ?';
    params.push(`%${req.query.genre}%`);
  }
  if (req.query.status) {
     querySQL += ' AND status = ?';
    params.push(req.query.status);
  }
  
  querySQL += ' ORDER BY id DESC';
  
  const stmt = db.prepare(querySQL);
  const juegos = stmt.all(...params);
  
  res.render('videojuegos', { juegos });
});

//FORMULARIO nuevo videojuego
app.get('/videojuegos/nuevo', requireLogin, (req, res) => {
  res.render('nuevo-videojuego');
});

//GUARDAR nuevo videojuego
app.post('/videojuegos/nuevo', requireLogin, (req, res) => {
const { title, platform, genre, status } = req.body;
  const stmt = db.prepare(`
    INSERT INTO games (title, platform, genre, status, user_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(title, platform, genre, status, req.session.userId);

  res.redirect('/videojuegos');
});

//FORMULARIO editar videojuego
app.get('/videojuegos/:id/editar', requireLogin, (req, res) => {
  const { id } = req.params;

  const stmt = db.prepare(`
    SELECT * FROM games
    WHERE id = ? AND user_id = ?
  `);

  const juego = stmt.get(id, req.session.userId);

  if (!juego) {
    return res.redirect('/videojuegos');
  }

  res.render('editar-videojuego', { juego });  // ✅ Renderiza el formulario con datos
});

//GUARDAR edición de videojuego
app.post('/videojuegos/:id/editar', requireLogin, (req, res) => {
  const { id } = req.params;
  const { title, platform, genre, status } = req.body;  // ✅ Nombres ingleses

  const stmt = db.prepare(`
    UPDATE games
    SET title = ?, platform = ?, genre = ?, status = ?
    WHERE id = ? AND user_id = ?
  `);

  stmt.run(title, platform, genre, status, id, req.session.userId);

  res.redirect('/videojuegos');
});

//BORRAR videojuego
app.post('/videojuegos/:id/borrar', requireLogin, (req, res) => {
  const { id } = req.params;

  const stmt = db.prepare(`
    DELETE FROM games
    WHERE id = ? AND user_id = ?
  `);

  stmt.run(id, req.session.userId);

  res.redirect('/videojuegos');
});



//FORMULARIO de registro
//Cuando vamos a Registrarse se crea una fila en users con username y password
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { usuario, password } = req.body;
  const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  stmt.run(usuario, password);
  res.redirect('/login');
});


app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});


//Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
