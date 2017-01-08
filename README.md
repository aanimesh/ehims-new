## How to run

From the root dir of the repo.
If this is the first time the app is being run:

```
npm install
mkdir -p data/db
```

Run `./start_db.sh` to get the database up and running. In a second terminal run
`node server.js` to start to app.

## Relevant Files

### app/models

This directory holds all the database schema.

#### app/models/storage.js

This file contains all the functions used for higher level database operations.
User/channel creation, joining channels, etc.

### app/routes

#### app/routes/routes.js

Each route is defined here. Logging in, channel creation/joining page, routes for
joining and creating a channel.

## bower_components/myassets

This directory has the static files for the front end.

### bower_components/myassets/js/channel.js

The behemoth of a file with all the frontend javascript for the channel page.

## Some notes

- Security is minimal. A good improvement would be to have the login be with sessions
rather than just to get to the page that lists all the channels. Note that if someone
knows a username and channel id, they can mimic the join post and get in without a 
password as that user. Additionally, the admin page which lists all the chats works
with a hardcoded password, and the page that actually lets you download a chat is 
completely free of password protection ('/download'). Obviously this would need to
change...
- A note on invites. There's a couple routes and a db schema for "Invites". An older
iteration of the site didn't have password protection, however, a user could generate
a password protected "Invite" link. The addition of password protection broke this,
but there are notes in the code about how to reconsile issues should this
functionallity be desired again.
- The current join bar uses the actual ID of the channel in the DB. Might be a good idea to abstract this a little since while they aren't exactly sequential, someone could potentially guess an ID. 




