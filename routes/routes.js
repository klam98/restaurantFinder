const express = require('express')
const router = express.Router();
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const moment = require('moment-timezone');



// set-up cookie session
router.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}));


module.exports = function (queries, io) {

  const restaurants_io = io.of('/restaurants');
  restaurants_io.on('connection', function(socket) {
    //console.log("We have a new client: " + socket.id);

    socket.on('joinRoom', function(room_id) {
      // Join a room for a specific restaurant
      socket.join(room_id);
      //console.log(`Client ${socket.id} has joined room ${room_id}`);
    });
    
    socket.on('disconnect', function() {
      //console.log("Client has disconnected");
    });
  });

  //redirect '/' to '/restaurants'
  router.get('/', function(req, res){
    res.redirect('/restaurants');
  })

  // rendering the login page
  router.get('/login', function (req, res) {
    const username = req.session.username;
    const err_msg = req.session.msg;
    
    // resets session variables
    req.session.username = null;
    req.session.msg = null;

    if (req.session.user_id != null){
      res.redirect('/');
    } else {
      const payload = {username: username, err_msg: err_msg};
      res.render('pages/login', payload);
    }
  })

  router.get('/register', function (req, res) {
    res.render('pages/register')
  })


  router.post('/register', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const hash = bcrypt.hashSync(password, saltRounds);


    queries.register(username, hash, (value) => {
      if (value.length != 0) {
        req.session.user_id = value[0].user_id;
        req.session.username = value[0].username;

        return res.redirect('/')
      } else {
        return res.redirect('/register')
      }
    })

  })

  // authenticate user after submitting login form
  router.post('/login', function (req, res) {

    const username = req.body.username;
    const password = req.body.password;
    req.session.username = username;

    try{
      if (!username.length) {
        req.session.msg = 'Please enter in a username.';
        res.redirect('/login');
      } else if (username.length > 25) {
        req.session.msg = 'The username you entered is too long.';
        res.redirect('/login');
      } else if (!password.length) {
        req.session.msg = 'Please enter in a password.';
        res.redirect('/login');

      } else {
        queries.Authenticate(username, (value) => {
          if (value.length != 0) {
            // Username exist
            const hash = value[0].password;
            if(bcrypt.compareSync(password, hash)){
              // Correct password
              req.session.user_id = value[0].user_id;
              req.session.username = value[0].username;
              req.session.msg = null;
              res.redirect('/');
            } else {
              // Incorrect password
              req.session.msg = 'Incorrect username or password.';
              res.redirect('/login');
            }
          } else {
            // No such username
            req.session.msg = 'Incorrect username or password.';
            res.redirect('/login');
          }
        })
      }
    } catch(e) {
      // Error
      req.session.msg = 'Error';
      res.redirect('/login');
    }


  })

  router.post('/logout', function(req, res){
    req.session.user_id = null ;
    res.redirect('/')
  })


  // rendering the restaurant page
  router.get('/restaurants', (req, res) => {
    const today = moment().tz("America/Vancouver")
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    // determine which day of the week
    const day = weekdays[today.day()]
    // console.log(today)

    queries.getRestaurants((value) => {

      const payload = {
                        user_id: req.session.user_id, 
                        open:[],
                        closed:[]
                      };
        
        value.forEach(function(val){


          if (val[day] == 'CLOSED'){
            payload.closed.push(val)
          } else if (val[day] == 'OPEN') {
            payload.open.push(val)
          } else {
            const businessHours = val[day].split("-")
            const startHour = moment(businessHours[0], "LT").tz("America/Vancouver")
            const endHour = moment(businessHours[1], "LT").tz("America/Vancouver")            

            if (today.isBetween(startHour, endHour) || today.isSame(startHour) || today.isSame(endHour)){
              payload.open.push(val)
            } else {
              payload.closed.push(val)
            }
          }
        })
        res.render('pages/restaurants', payload)
    })
    
  })


  // rendering the admin page
  router.get('/admin', (req, res) => {

    if (req.session.user_id == null){
      return res.redirect('/')
    }

    queries.verifyAdmin(req.session.user_id, (value) => {
      const admin = value[0].admin;

      if (admin == false){
        return res.redirect('/');
      } else {
        queries.getRestaurants((value) => {
            res.render('pages/admin', {value:value, user_id: req.session.user_id})
        })
      }
    })
  })


  router.get('/admin/add', (req, res) => {

    if (req.session.user_id == null){
      return res.redirect('/')
    }

    queries.verifyAdmin(req.session.user_id, (value) => {
      const admin = value[0].admin;
      // console.log(admin)
      if (admin == false){
        return res.redirect('/');
      } else {
        res.render('pages/add', {user_id: req.session.user_id});
      }
    })    

  })

  router.post('/admin/add', (req, res) => {
    const name = req.body.name;
    const address = req.body.address;
    const description = req.body.description;
    const price = req.body.price;
    const sunday = req.body.sunday;
    const monday = req.body.monday;
    const tuesday = req.body.tuesday;
    const wednesday = req.body.wednesday;
    const thursday = req.body.thursday;
    const friday = req.body.friday;
    const saturday = req.body.saturday;
    const tags = ['good', 'food', 'cheap']

    queries.addRestaurant(name, price, address, description, tags, (value, error) => {

      queries.getLatestRestaurantId((value, error) => {
        
        const restaurant_id = value[0].restaurant_id;

        queries.addOpenHours(restaurant_id, sunday, monday, tuesday, wednesday, thursday, friday, saturday, (value, error) => {
          
          const image_path = "/Pictures/restaurant_" + restaurant_id.toString() + ".jpg";

          queries.addImage(restaurant_id, image_path, (value, error) => {

            return res.redirect('/admin/add');
          })
        })
      })
    })
  })

  router.post('/admin/edit/:id', (req, res) => {
    const restaurant_id = req.params.id;
    const name = req.body.name;
    const address = req.body.address;
    const description = req.body.description;
    const price = req.body.price;
    const sunday = req.body.sunday;
    const monday = req.body.monday;
    const tuesday = req.body.tuesday;
    const wednesday = req.body.wednesday;
    const thursday = req.body.thursday;
    const friday = req.body.friday;
    const saturday = req.body.saturday;

    queries.updateRestaurant(restaurant_id, name, price, address, description, (value, error) => {

      queries.updateOpenHours(restaurant_id, sunday, monday, tuesday, wednesday, thursday, friday, saturday, (value, error) => {

        return res.redirect('/admin');
      })
    })
  })

  router.delete('/admin/delete/:id', (req, res) => {
    const restaurant_id = req.params.id;

    queries.deleteRestaurant(restaurant_id, (value, error) => {
      return res.redirect('/admin');
    })
  })

  router.get('/restaurants/:id', (req, res) => {
    const restaurant_id = req.params.id
    queries.getRestaurantDetail(restaurant_id, (value, error) => {
      
      const restaurants = value;
      const sortOrder = {clause: 'create_date', order: 'desc'};

      queries.getComments(restaurant_id, sortOrder, (value, error) => {
        const comments = value;

        // parse create_date
        var months = ['January', "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        for (var i=0; i<comments.length; i++) {
          let date = comments[i].create_date.getDate(),
              month = comments[i].create_date.getMonth(),
              year = comments[i].create_date.getFullYear();
          comments[i].create_date = `${months[month]} ${date}, ${year}`;
        }

        const payload = {
                          value: restaurants,
                          comments: comments,
                          user_id: req.session.user_id,
                          username: req.session.username
                        }
        res.render('pages/details', payload);
      })
    })
  })

  router.post('/restaurants/:id', (req, res) => {
    const restaurant_id = req.params.id;
    const user_id = req.session.user_id;
    const username = req.session.username;
    const rating = req.body.rating;
    const create_date = req.body.create_date;
    const comment = req.body.comment;


    if (!comment.replace(/\s/g, '').length) {
      // empty review
      res.send({err: true, msg: 'Please filled in something to comment!'});

    } else if (!rating){
      // no rating
      res.send({err: true, msg: 'Please enter in a rating.'});

    } else if (!username || !user_id){
      // no username
      res.send({err: true, msg: 'Please login to post a comment.'});

    } else {
      // add comment into database
      queries.postComment(restaurant_id, user_id, rating, comment, (value, error) => {
        if (error) {
          // failed to add comment
          res.send({err: true, msg: 'Failed to post the comment.'});

        } else {
          // send new comments to all clients in the same page
          restaurants_io.to(restaurant_id).emit('new_comment', {
            username: username, 
            rating: rating, 
            create_date: create_date, 
            comment: comment
          });

          res.send({err: false, msg: 'success'});
        }
      });
    }

  });

  router.get('/admin/edit/:id', (req, res) => {
    const restaurant_id = req.params.id
    queries.getRestaurantDetail(restaurant_id, (value, error) => {
      
      const restaurants = value;

      const payload = {
                        value: restaurants,
                        user_id: req.session.user_id,
                        username: req.session.username
                      }

      res.render('pages/edit', payload);
    })
  })

  return router;
}