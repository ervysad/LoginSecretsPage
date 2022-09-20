//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const app = express();
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/public", express.static("public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


//connectiong to mongodb  
try {
    mongoose.connect('mongodb://localhost:27017/userDB'); //add your own db with the wikiSchema here.
    console.log("Connected to DB...");
} catch (error) {
    console.log(error);
}


const userSchema = new mongoose.Schema({

    username:String,
  
    password:String,
  
    googleId: String,
  
    secret: String
  
  });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema); //check the Mayus here al crear la collection va a quitar la mayuscula y a pluralizar el nombre.


passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id, username:profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));  

app.get("/", function (req, res) {
    res.render("home")
});

app.get("/auth/google", passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });


app.get("/register", function (req, res) {
    res.render("register")
});
app.get("/login", function (req, res) {
    res.render("login")
});


app.get("/secrets", function (req, res) {
    res.set(
        'Cache-Control', 
        'no-cache, private, no-store, must-revalidate, max-stal e=0, post-check=0, pre-check=0'
    );

    //check if the request is comming from an authenticated user or not
    if (req.isAuthenticated()) {

        User.find({"secret":{$ne:null}}, function(err, foundUsers){
            if(foundUsers){
                res.render("secrets",{usersWithSecretsEjs:foundUsers});
            }
        });
    } else {
        res.redirect("login");
    }

});

app.get("/submit", function(req, res){
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("login");
    }
})

app.get("/logout", function(req,res, next){
    //end a user session
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
});

app.post("/register", function (req, res) {
    const email = req.body.username;
    const pass = req.body.password;
    User.register({ username: email, }, pass, function (err, newuser) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                //This launch when ath is successfull
                res.redirect("/secrets");
            });
        };
    });
});


app.post("/login", function (req, res) {
    const emailReceived = req.body.username;
    const passReceived = req.body.password;
    //creamos un usuario local, we never save it in the db.
    const tempuser = new User({
        email: emailReceived,
        password: passReceived
    });
    req.login(tempuser, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                //This launch when ath is successfull
                res.redirect("/secrets");
            });
        }
    })

});

app.post("/submit",function(req,res){
    const submittedSecret = req.body.secret;
    const user = req.user;
    const user_id = req.user._id;
    
    User.find({id:user_id}, function(err, foundUser){
        if(err){
            res.send(err)
        } else {
            if(foundUser){
                User.updateOne({_id:user_id},{secret:submittedSecret},  function(err){
                    if(err){
                        console.log(err);
                    }else{
                        res.redirect("/secrets")
                        console.log("updated succsess");
                    }
                })
            }
        }
    });
})

app.listen(process.env.PORT || 3000, function () {
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});



