const express = require('express');
const router = require('./lib/router');

const app = express();

const PORT = process.env.PORT || 5555;

const cors = require('cors');
app.use(cors());

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', router(app, express));

app.listen(PORT, () => console.log(`Listening on port ${PORT}.`));