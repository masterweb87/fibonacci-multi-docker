// Server-side
const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgress client setup
const { Pool } = require('pg');
const pgClient = new Pool({
	user: keys.pgUser,
	password: keys.pgPassword,
	host: keys.pgHost,
	port: keys.pgPort,
	database: keys.pgDatabase
});
pgClient.on('error', () => console.log('Error al intentar conectar con Postgres'));

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
	.catch((err) => console.log(err));
	
// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// Express routes
app.get('/', (req, res) => {
	res.send('Hola');
});

app.get('/values/all', async (req, res) => {
	const values = await pgClient.query('SELECT * from values');
	res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
	redisClient.hgetall('values', (err, values) => {
		res.send(values);
	});
});

app.post('/values', async (req, res) => {
	const index = req.body.index;
	// Because fibonacci can take really long values, we put a limit
	if(parseInt(index) > 40) {
		return res.status(422).send('Indice demasiado alto. Pon uno mas bajito');
	}
	
	redisClient.hset('values', index, 'Nada');
	redisPublisher.publish('insert', index);
	
	pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
	
	res.send({ working: true });
});

app.listen(5000, err => {
	console.log('Escuchando en el puerto 5000!');
});