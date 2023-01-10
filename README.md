# Berta Berlin youtube cache webworker

### Dependencies

This lib requires no further dependencies.

### Configuration

In `config.js` you can configure the cache worker's behavior. Most notably:

`CACHE_PATH`: The location on your local filesystem for data to be cached.<br/>
`YOUTUBE_API_CACHE_STALE_TIME`: The time interval for data to be cached.<br/>
`YOUTUBE_CHANNEL_ID`: The id of the youtube channel to get cached.

### Usage

In your node express application...

```
const express = require('express');
const app = express();

// ...REQUIRE THE CACHE WORKER'S ROUTER

const bertaRouter = require('path-to-cache-worker/router');

// ...PASS EXPRESS AND YOUR APP TO THE ROUTER AND app.use IT ON YOUR ROUTE

app.use('/my-cache-route', bertaRouter(app, express));

app.listen('8080');
```

Done!<br/><br/>
The cache worker will now update the youtube data in the interval set in `config.js`.<br/><br/>
You can fetch the cached data with a GET request to your route. Don't forget to pass the `resource` query parameter with a value from `ALLOWED_RESOURCES` in `config.js`.<br/><br/>
Example GET path:

```angular2html
/my-cache-route?resource=video
```