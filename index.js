const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const RSS = require("rss-generator");
const Parser = require("rss-parser");
const app = express();
const PORT = 8080;

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

var feed;
const servername = "localhost:8080";
const vorlesungsname = "test";

function regenerateFeed(id, feeddata) {
    const feed = new RSS(feeddata.meta);
    for (let i = 0; i < feeddata.items.length; i++) {
        feed.item(feeddata.items[i]);
    }
    const xml = feed.xml();
    fs.writeFileSync(`${__dirname}/public/${id}/rss.xml`, xml);
}

// generate page from view
app.get("/", function (req, res) {
    // create directory for new playlist
    const folderName = `${__dirname}/public/${req.query.id}`;
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
        let feeddata = {
            meta: {
                title: `${req.query.id}`, //TODO Titel in html form
                feed_url: `${req.protocol}://${req.host}:${PORT}/${req.query.id}/rss.xml`,
                site_url: `${req.protocol}://${req.host}:${PORT}/${req.query.id}/`
            },
            items: []
        };
        fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
        regenerateFeed(req.query.id, feeddata);
    }

    res.render("index", {
        id: req.query.id,
        rsspath: `${req.protocol}://${req.host}:${PORT}/${req.query.id}/rss.xml`
    });
});

app.use("/", express.static(__dirname + "/public"));

/* hier könnte man die feeds speichern
let feeds = {
  "mertensgeheimerordner": null
};*/

app.post("/convert", (req, res) => {
    let file = req.files.file;
    // TODO make sure file actually contains an extension
    let fileName = `${file.name.split(".").slice(0, -1).join(".")}.mp3`; // replace file extension with mp3
    // save video file to tmp directory
    file.mv("tmp/" + file.name, function (err) {
        if (err) return res.sendStatus(500)
        console.log("File Uploaded successfully");
    });
    // convert to mp3
    ffmpeg("tmp/" + file.name)
        .noVideo()
        .audioCodec("libmp3lame")
        .saveToFile(`${__dirname}/public/${req.query.id}/${fileName}`)
        .on("end", function (stdout, stderr) {
            res.send(200);
            console.log("Finished");

            const folderName = `${__dirname}/public/${req.query.id}`;
            let feeddata = JSON.parse(fs.readFileSync(folderName + "/feed.json").toString());
            feeddata.items.push({
                title: fileName, //html form
                enclosure: {url: `${req.protocol}://${req.host}:${PORT}/${req.query.id}/${fileName}`}
            });
            fs.writeFileSync(folderName + "/feed.json", JSON.stringify(feeddata));
            regenerateFeed(req.query.id, feeddata);

            // redirect to converted audio file
            //res.redirect(`${req.baseUrl}/${req.query.id}/rss.xml`);

            // remove video file
            fs.unlink("tmp/" + file.name, function (err) {
                if (err) throw err;
                console.log("File deleted");
            });
        })
        .on("error", function (err) {
            console.log("an error happened: " + err.message);
            // remove video file
            fs.unlink("tmp/" + file.name, function (err) {
                if (err) throw err;
                console.log("File deleted");
            });
        });
});

app.listen(PORT);
