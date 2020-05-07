const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const RSS = require("rss-generator");
const Parser = require("rss-parser");
const randomstring = require("randomstring");
const path = require('path');
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

app.set("view engine", "pug");

ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
ffmpeg.setFfprobePath("/usr/bin/ffprobe");
ffmpeg.setFlvtoolPath("/usr/bin/ffplay");

function regenerateFeed(feeddata) {
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
        title: fileName,
        enclosure: {url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/${fileName}`}
    });
    fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
    regenerateFeed(feeddata);
}

function removeFile(pathToFile) {
    fs.unlink(pathToFile, function (err) {
        if (err) throw err;
        console.log("File deleted");
    });
}

function convertToMP3(file, req, res) {
    // replace file extension with mp3
    let fileName = `${file.name.split(".").slice(0, -1).join(".")}.mp3`;
    // save video file to tmp directory
    file.mv("tmp/" + file.name, function (err) {
        if (err) return res.sendStatus(500)
        console.log("File Uploaded successfully");
    });
    // convert to mp3
    ffmpeg("tmp/" + file.name)
        .noVideo()
        .audioCodec("libmp3lame")
        .saveToFile(`${home}/${req.query.id}/${fileName}`)
        .on("end", function (stdout, stderr) {
            res.send(200);
            console.log("Finished");
            addItem(fileName, req);

            // redirect to converted audio file
            //res.redirect(`${req.baseUrl}/${req.query.id}/rss.xml`);

            // remove video file
            removeFile("tmp/" + file.name);
        })
        .on("error", function (err) {
            console.log("an error happened: " + err.message);
            // remove video file
            removeFile("tmp/" + file.name);
        });
}

// generate page from view
app.get("/", function (req, res) {
    // create directory for new playlist
    if (req.query.id == null) {
        var rndFolder = randomstring.generate({
            length: 10,
            charset: "alphanumeric"
        });
        return res.redirect("/?id="+rndFolder);
    }
    const folderName = `${home}/${req.query.id}`;
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
        let feeddata = {
            meta: {
                title: `${req.query.id}`,
                feed_url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/rss.xml`,
                site_url: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/`
            },
            items: []
        };
        fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
        regenerateFeed(req.query.id, feeddata);
    }

    res.render("index", {
        id: req.query.id,
        rsspath: `${req.protocol}://${req.hostname}:${PORT}/${req.query.id}/rss.xml`
    });
});

app.use("/", express.static(__dirname + "/public"));

app.post("/convert", (req, res) => {
    let file = req.files.file;
    let extn = path.extname(file.name);
    if (extn == ""){
        return res.sendStatus(500);
    }
    else{
        convertToMP3(file, req, res);
    }
});

app.listen(PORT);
