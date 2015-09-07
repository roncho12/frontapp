
var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');
var UM = require('./modules/uploads-manager');
var func = require('./functions');
var gm = require('gm');

module.exports = function (app) {

    // main login page //

    app.get('/', function (req, res) {
        // check if the user's credentials are saved in a cookie //
        if (req.cookies.user == undefined || req.cookies.pass == undefined) {
            res.render('login', {title: 'Hello - Please Login To Your Account'});
        } else {
            // attempt automatic login //
            AM.autoLogin(req.cookies.user, req.cookies.pass, function (o) {
                if (o != null) {
                    req.session.user = o;
                    res.redirect('/home');
                    func.log(o.user + " has logged in");

                } else {
                    res.render('login', {title: 'Hello - Please Login To Your Account'});
                }
            });
        }
    });

    app.post('/', function (req, res) {
        AM.manualLogin(req.body['user'], req.body['pass'], function (e, o) {
            if (!o) {
                res.status(400).send(e);
            } else {
                req.session.user = o;

                res.cookie('user', o.user, {maxAge: 900000});
                res.cookie('pass', o.pass, {maxAge: 900000});

                func.log(o.user + " has logged in");
                res.status(200).send(o);
            }
        });
    });

    // logged-in user homepage //

    app.get('/home', function (req, res) {
        if (req.session.user == null) {
            // if user is not logged-in redirect back to login page //
            res.redirect('/');
        } else {
            res.render('home', {
                title: 'Control Panel',
                countries: CT,
                udata: req.session.user
            });
        }
    });

    app.post('/home', function (req, res) {
        if (req.body['user'] != undefined) {
            AM.updateAccount({
                user: req.body['user'],
                name: req.body['name'],
                email: req.body['email'],
                pass: req.body['pass'],
                country: req.body['country']
            }, function (e, o) {
                if (e) {
                    res.status(400).send('error-updating-account');
                } else {
                    req.session.user = o;
                    res.cookie('user', o.user, {maxAge: 900000});
                    res.cookie('pass', o.pass, {maxAge: 900000});

                    res.status(200).send('ok');
                }
            });
        } else if (req.body['logout'] == 'true') {
            res.clearCookie('user');
            res.clearCookie('pass');
            req.session.destroy(function (e) {
                res.status(200).send('ok');
            });
        }
    });

    // creating new accounts //

    app.get('/signup', function (req, res) {
        res.render('signup', {title: 'Signup', countries: CT});
    });

    app.post('/signup', function (req, res) {
        AM.addNewAccount({
            name: req.body['name'],
            email: req.body['email'],
            user: req.body['user'],
            pass: req.body['pass'],
            country: req.body['country']
        }, function (e) {
            if (e) {
                res.status(400).send(e);
            } else {
                res.status(200).send('ok');
            }
        });
    });

    app.post('/delete', function (req, res) {
        AM.deleteAccount(req.body.id, function (e, obj) {
            if (!e) {
                res.clearCookie('user');
                res.clearCookie('pass');
                req.session.destroy(function (e) {
                    res.status(200).send('ok');
                });
            } else {
                res.status(400).send('record not found');
            }
        });
    });

    app.post('/api/log_message', function (req, res) {
        func.log(req.body['message']);
        res.status(200).send('ok');
    });

    ////////////////////////
    // File/Image actions //
    ////////////////////////
    app.post('/api/photo_upload', function (req, res) {
        if (GLOBAL.upload_done === true) {
            var user_agent, file;

            user_agent = req.headers['user-agent'];
            file = req.files[0];

            // Auto orient (ensures images uploaded using mobile devices are handled
            // correctly).
            gm(file.path).orientation(function (err, value) {
                func.log('orientation callback, err: ' + err);
                func.log('orientation callback, value: ' + value);
            });

            gm(file.path).autoOrient().write(file.path, function (err) {
                if (err) {
                    func.log('could not autoOrient the following image: ' + file.path);
                    res.json({did_succeed: false, file: file});

                } else {
                    func.log('uploaded file: ' + file.path);
                    UM.insert_user_uploaded_file(file, req.cookies.user, func.log);
                    res.json({did_succeed: true, file: file});
                }
            });
        }
    });

    app.get('/api/get_user_photos', function (req, res) {
        UM.get_uploaded_files_by_username(req.cookies.user, function (result) {
            res.json(result);
        });
    });

    app.post('/api/delete_image', function (req, res) {
        UM.delete_image(req.body['filename']);
        res.status(200).send('ok');
    });

    app.post('/api/frontalize_image', function (req, res) {
        var file, did_succeed;

        file = req.body['file'];

        did_succeed = func.frontalize_image(file);

        res.json({did_succeed: did_succeed, file: file});
    });
};