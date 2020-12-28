const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const RSS = require("rss-generator");
const Parser = require("rss-parser");
const randomstring = require("randomstring");
const path = require('path');
const rimraf = require("rimraf");
const app = express();

const PORT = 8080;
const home = `${__dirname}/public`;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// parse application/json
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
    })
);

app.use("/", express.static(__dirname + "/public"));

app.set("view engine", "pug");

ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
ffmpeg.setFfprobePath("/usr/bin/ffprobe");
ffmpeg.setFlvtoolPath("/usr/bin/ffplay");

function regenerateFeed(req, feeddata) {
    const feed = new RSS(feeddata.meta);
    for (let i = 0; i < feeddata.items.length; i++) {
        feed.item(feeddata.items[i]);
    }
    const xml = feed.xml();
    fs.writeFileSync(`${home}/${req.query.id}/rss.xml`, xml);
}

function addItem(fileName, req) {
    let folderName = `${home}/${req.query.id}`;
    let feeddata = JSON.parse(fs.readFileSync(folderName + "/feed.json").toString());
    feeddata.items.push({
        title: `${req.body.Title}`,
        description: `${req.body.Title}`,
        author: `${req.body.Title}`,
        enclosure: {url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/${fileName}`}
    });
    fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
    regenerateFeed(req, feeddata);
}

function remove (file) {
    fs.unlink(file, function (err) {
        if (err) throw err;
    });
}

function move (file, to){
    file.mv(to, function (err) {
        if (err) return res.sendStatus(500)
        console.log("File Uploaded successfully");
    });
}

function convertToMP3(file, req) {
    // replace file extension with mp3
    let fileName = `${file.name.split(".").slice(0, -1).join(".")}.mp3`;
    
    // save video file to tmp directory
    move(file, "tmp/" + file.name)
    
    // convert to mp3
    ffmpeg("tmp/" + file.name)
        .noVideo()
        .audioCodec("libmp3lame")
        .saveToFile(`${home}/${req.query.id}/${fileName}`)
        .on("end", function (stdout, stderr) {
            console.log("Finished");

            addItem(fileName, req);

            // remove video file
            remove("tmp/" + file.name);
        })
        .on("error", function (err) {
            console.log("an error happened: " + err.message);
            // remove video file
            remove("tmp/" + file.name);
        });
}

// generate homepage from view
app.get("/", function (req, res) {
    if (req.query.id == null) {
        var rndFolder = randomstring.generate({
            length: 10,
            charset: "alphanumeric"
        });
        return res.redirect("/?id="+rndFolder);
    }
    
    res.render("index", {
        id: req.query.id,
        rsspath: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/rss.xml`
    });
});

app.post("/create", (req, res) => {
    //TODO Hier string generieren und redirect auf zweite HTML-Seite (add,remove)
    const folderName = `${home}/${req.query.id}`;
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
        console.log(req.query.id + "created");
        let feeddata = {
            meta: {
                title: `${req.body.Title}`,
                description: `${req.body.Title}`,
                docs: `${req.body.Title}`,
                feed_url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/rss.xml`,
                site_url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/`
            },
            items: [ ]
        };
        fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
        regenerateFeed(req, feeddata);
    }
    return res.redirect("/?id=" + req.query.id);
});

app.post("/addItem", (req, res) => {
    let file = req.files.file;
    let extn = path.extname(file.name);
    if (extn == ""){
        return res.sendStatus(500);
    }
    convertToMP3(file, req);
    return res.redirect("/?id=" + req.query.id);
});

app.post("/removePlaylist", (req, res) => {
    rimraf(`${home}/${req.query.id}`, (err) => {
        if(err) return res.sendStatus(500);
        console.log(req.query.id + "deleted");
    })
    return res.redirect("/");
});

app.post("/removeItem", (req, res) => {
    remove(`${home}/${req.query.id}/${req.body.Item}`);
    return res.redirect("/?id=" + req.query.id);
});

app.listen(PORT);
