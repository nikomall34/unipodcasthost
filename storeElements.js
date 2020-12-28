function addItem(id) {
    if (localStorage.getItem(id) == null) {
        localStorage.setItem(id, window.location.href);
    }
}

function listAllItems() {
    var keys = Object.keys(localStorage);
    var length = keys.length;
    var res = [];
    for(let i = 0; i < length; i++){
        res.push( keys[i] + "=" + localStorage.getItem(keys[i]));
    }
    return res;
}