async function fetcher(fetchFunc, key, callback) {
    let timeKey = key + "$$time";
    let oneHour = 3600*1000;
    chrome.storage.local.get([key, timeKey], async function(items) {
        if (items[key] && items[timeKey]) {
            if (items[timeKey] > Date.now() - oneHour) {
                callback(items[key]);
                return;
            }
        }
        let res = await fetchFunc();
        let d = {};
        d[timeKey] = Date.now();
        d[key] = res;
        chrome.storage.local.set(d);
        callback(res);
    });
}



function getCSRF() {
    return fetch("https://www.wikidata.org/w/api.php?action=query&meta=tokens&format=json")
        .catch(function(err) {
            console.log('Fetch Error :-S', err);
        })    
        .then(
            function(response) {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' +
                                response.status);
                    return;
                }

                return response.json().then(function(data) {
                    let token = data.query.tokens.csrftoken;
                    return token;
                });
            }
        );
}

function loadPatternsLive() {
        let propQuery = `
SELECT ?p ?regexValue (COALESCE(?replacement, "\\\\1") as ?replacementString) (COALESCE(?q = wd:Q55121297, false) as ?caseInsensitive)
WHERE {
  ?p p:P8966 ?regex.
  ?regex ps:P8966 ?regexValue
  OPTIONAL {
     ?p wdt:P1552 ?q.
     ?q wdt:P31 wd:Q55121384.
  }
 OPTIONAL {?regex pq:P8967 ?replacement.}
}`;
    const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(propQuery);
    return fetch(url).then((x) => x.json()).then((res) => {
        let regexCache = {};
        for(let prop of res.results.bindings) {
            let propUrl = prop.p.value;
            let splitUrl = propUrl.split("/");
            let propId = splitUrl[splitUrl.length - 1];
            let regex = prop.regexValue.value;
            let replacementValue = prop.replacementString.value;
            let caseInsensitive = prop.caseInsensitive.value;
            regexCache[regex] = {prop: propId, replacementValue: replacementValue, caseInsensitive: caseInsensitive};
        }
        return regexCache;
    });
}

let bannedProps = {"P8176": 1}


var matchers = null;
function getPropertyMatchers() {
    fetcher(loadPatternsLive, "PATTERNS", function(p) {
        matchers = p;
    });
}
getPropertyMatchers();

function getSiteFromUrl(url) {
    let parsedUrl = new URL(url);
    let host = parsedUrl.hostname;
    let langCode = host.split(".")[0];
    return langCode + "wiki";    
}

function getWikidataEntity(url) {
    let path = "https://www.wikidata.org/wiki/Special:ItemByTitle?"

    let site = getSiteFromUrl(url)
    let split_url = url.pathname.split("/")
    split_url.shift(); // shift out the leading "/"
    split_url.shift(); // shift out the "wiki/"
    let wiki_article_name = split_url.join("/");
    let args = "site=" + site + "&page=" + wiki_article_name;
    return fetch(path + args).catch(function(err) {
        console.error(err);
    }).then(function(res){
        if (res.redirected && res.status == 200) {
            let redirect_url = new URL(res.url);
            let path_split = redirect_url.pathname.split("/");
            let entity = path_split[path_split.length - 1];
            return entity;
        } else {
            console.error("Failed to get wikidata entity");
        }
    });
}

function getWikidataMarkup(entity) {
    let path = `https://www.wikidata.org/wiki/Special:EntityData/${entity}.json`;
    return fetch(path, {cache: "no-store"}).then(function(res){return res.json()});
}


chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostSuffix: 'google.com'},
            css: ["div.kp-wholepage"]
        })
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()]
        },{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostSuffix: 'google.com'},
            css: ["div.knowledge-panel"]
        })],
        actions: [new chrome.declarativeContent.ShowPageAction()]
        }
     ]);
    });
});

chrome.pageAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript({
        file: 'content.js'
    });
});

let WEBSITE_CLAIM = "P856";
let TWITTER_CLAIM = "P2002";
let INSTA_CLAIM = "P2003";
let FB_CLAIM = "P2013";
let YT_CLAIM = "P2397";
let MY_SPACE_CLAIM = "P3265";
let SOUND_CLOUD_CLAIM = "P3040";
let LINKEDIN_CLAIM = "P6634"
let FREEBASE_CLAIM = "P646";
let PINTEREST_CLAIM = "P3836";
let GOOGLE_KNOWLEDGE_CLAIM = "P2671";
let GOODREADS_BOOK_CLAIM = 'P2969';
let ROTTEN_TOM_CLAIM = 'P1258';
let METACRIT_CLAIM = 'P1712';
let GOOGLE_SCHOLAR_CLAIM = 'P1960';

let DEEZER_ARTIST_CLAIM = "P2722";
let ITUNES_ARTIST_CLAIM = "P2850";
let SPOTIFY_ARTIST_CLAIM = "P1902";
let TUNE_IN_ARTIST_CLAIM = "P7192";
let PLAY_ARTIST_CLAIM = "P4198";

let PLAY_APP_ID_CLAIM = "P3418";
let APP_STORE_ID_CLAIM = "P3861";

let IMDB_CLAIM = "P345";
let RETRIEVED_CLAIM = "P813";

let STOCK_EXCHANGE_CLAIM = "P414";
let TICKER_CLAIM = "P249";

let EXCHANGE_TO_ENTITY = {
    "NASDAQ" :  "Q82059",
    "NYSE":  "Q13677",
    "LON": "Q171240",
    "NSE": "Q638740",
    "TYO": "Q217475",
    "OTCMKTS": "Q1930860",
    "HEL": "Q581755",
    "STO": "Q1019992",
    "TAL": "Q1433248",
    "SHE": "Q517750",
    "HKG": "Q496672",
    "ELI": "Q2415561",
    "TPE":"Q548621",
    "BVMF":"Q796297",
    "NZE": "Q627019",
    "ASX": "Q732670"
};

async function makeItem(rawToken, name, desc) {
    let rawData = {}
    rawData.labels = {"en": { "language": "en", "value": name}};
    rawData.descriptions = {"en": { "language": "en", "value": desc}};
    let data = encodeURIComponent(JSON.stringify(rawData));
    let token = encodeURIComponent(rawToken);
    let args = `token=${token}&data=${data}&new=item&summary=create for import`;
    console.log(args)
    let res = await fetch("https://www.wikidata.org/w/api.php?action=wbeditentity&format=json&new=item", {
      "headers": {
          "content-type": "application/x-www-form-urlencoded",
      },
      "body": args,
      "method": "POST",
      "mode": "cors",
      "credentials": "include"
    }).then(function(data){return data.json();});
    if (res && res.success) {
        return res.entity.id;
    } else {
        console.log("Failed to create item!");
        return null;
    }
}

function makeClaim(entity, property, value, rawTags, rawToken, graphId) {
    if (value && value.length == 0) { // don't set empty values
        console.log("can't claim empty values");
        return Promise.resolve(null);
    }
    let base_url = "https://www.wikidata.org/w/api.php?action=wbcreateclaim&format=json&snaktype=value&";
    let token = encodeURIComponent(rawToken);
    let tags = rawTags.map(encodeURIComponent).join("|");
    let wrappedValue = encodeURIComponent(JSON.stringify(value));        
    let getArgs = `entity=${entity}&property=${property}&value=${wrappedValue}&tags=${tags}`
    let summary = encodeURIComponent("scraped data from google");
    let args = `token=${token}&summary=${summary}`;
    

    return fetch(base_url + getArgs, {
        method: 'POST',
        body: args,
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "accept":"application/json, text/javascript, */*; q=0.01"
        }
    }).then(function(data){return data.json();}).then(function(data){return addRef(data, rawToken, graphId);});
}

function addQualifier(claim, property, snak, rawToken) {
    let base_url = "https://www.wikidata.org/w/api.php?action=wbsetqualifier&format=json&";
    let token = encodeURIComponent(rawToken);
    let summary = encodeURIComponent("scraped data from google");
    let encodedSnak = encodeURIComponent(JSON.stringify(snak));
    let bodyArgs = `token=${token}&summary=${summary}&snaktype=value`;
    let args = `property=${property}&claim=${claim}&value=${encodedSnak}`;
    return fetch(base_url + args, {
        method: 'POST',
        body: bodyArgs,
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "accept":"application/json, text/javascript, */*; q=0.01"
        }
    });
}


function currentTimeValue() {
    let now = new Date();
    now.setUTCSeconds(0, 0);
    now.setUTCHours(0);
    now.setUTCMinutes(0);
    // hack to strip fractional seconds due to https://phabricator.wikimedia.org/T247148
    let today = "+" + now.toISOString().replace(".000","");
    return {"type":"time","value":{"after":0,"before":0,"calendarmodel":"http://www.wikidata.org/entity/Q1985727","precision":11,"time":today,"timezone":0}};
}

function addGraphId(snack, graphId) {
    if (graphId) {
        if (graphId.startsWith("/m/")) {
            snack[FREEBASE_CLAIM] = [{"snaktype":"value","property":FREEBASE_CLAIM,"datavalue":{"type":"string","value":graphId}}];
        } else if (graphId.startsWith("/g/")) {
            snack[GOOGLE_KNOWLEDGE_CLAIM] = [{"snaktype":"value","property":GOOGLE_KNOWLEDGE_CLAIM,"datavalue":{"type":"string","value":graphId}}];
        }
    }
}

function addRef(data, rawToken, graphId) {
    let base_url = "https://www.wikidata.org/w/api.php?action=wbsetreference&format=json&";
    let token = encodeURIComponent(rawToken);
    let summary = encodeURIComponent("scraped data from google");
    let refSnack = {"P248":[{"snaktype":"value","property":"P248","datavalue":{"type":"wikibase-entityid","value":{"id":"Q648625"}}}]};

    refSnack[RETRIEVED_CLAIM] = [{"snaktype":"value","property":"P813","datavalue": currentTimeValue()}];
    addGraphId(refSnack, graphId);
    let snaks =  encodeURIComponent(JSON.stringify(refSnack));
    let args = `token=${token}&summary=${summary}`;
    let success = data.success;
    if (success == 1) {
        let statementId = data.claim.id;
        let getArgs = `statement=${statementId}&snaks=${snaks}`;
        return fetch(base_url + getArgs, {
            method: 'POST',
            body: args,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "accept":"application/json, text/javascript, */*; q=0.01"
            }
        }).then(function(data){return Promise.resolve(statementId);});
    }
    return Promise.resolve(null);
}

function processSocialMediaUrl(stringUrl, claims, entity, token, graphId) {
    let url = new URL(stringUrl);
    let args = new URLSearchParams(url.search);
    let host = url.host.toLowerCase();
    let split_path = url.pathname.split("/");
    split_path.shift(); // shift out the empty string
    if (host.endsWith("twitter.com")) {
        if (!(TWITTER_CLAIM in claims)) {
            var handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, TWITTER_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("instagram.com")) {
        if (!(INSTA_CLAIM in claims)) {
            var handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, INSTA_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("pinterest.com")) {
        if (!(PINTEREST_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }                                
            return makeClaim(entity, PINTEREST_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("facebook.com")) {
        if (!(FB_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }                
            return makeClaim(entity, FB_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("linkedin.com")) {
        if (!(LINKEDIN_CLAIM in claims)) {
            // TODO: handle linkedin 
        }
    } else if (host.endsWith("youtube.com")) {
        if (!(YT_CLAIM in claims)) {            
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            if (handle.startsWith("UC") && handle.length == 24) {
                return makeClaim(entity, YT_CLAIM, handle, [], token, graphId);
            }
        }
    } else if (host.endsWith("soundcloud.com")) {
        if (!(SOUND_CLOUD_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, SOUND_CLOUD_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("myspace.com")) {
        if (!(MY_SPACE_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, MY_SPACE_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("imdb.com")) {
        if (!(IMDB_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, IMDB_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("spotify.com") && split_path[0] == "artist") {
        if (!(SPOTIFY_ARTIST_CLAIM in claims)) {
            let handle = split_path[1];
            return makeClaim(entity, SPOTIFY_ARTIST_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("deezer.com") && split_path[0] == "artist") {
        if (!(DEEZER_ARTIST_CLAIM in claims)) {
            let handle = split_path[1];
            return makeClaim(entity, DEEZER_ARTIST_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("tunein.com") && split_path[0] == "artist") {
        if (!(TUNE_IN_ARTIST_CLAIM in claims)) {
            let handle = split_path[1];
            return makeClaim(entity, TUNE_IN_ARTIST_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("play.google.com") && split_path[0] == "music" &&
               split_path[1] == "r" && split_path[2] == "m") {
        if (!(PLAY_ARTIST_CLAIM in claims)) {
            let handle = split_path[3];
            return makeClaim(entity, PLAY_ARTIST_CLAIM, handle, [], token, graphId);
        }
    } else if (host.endsWith("play.google.com") && split_path[0] == "store" &&
               split_path[1] == "apps" && split_path[2] == "details") {
        if (!(PLAY_APP_ID_CLAIM in claims)) {
            let appId = args.get("id");
            if (appId) {
                return makeClaim(entity, PLAY_APP_ID_CLAIM, appId, [], token, graphId);
            }
        }
    } else if (host.endsWith("apps.apple.com")) {
        if (!(APP_STORE_ID_CLAIM in claims)) {
            let appId = split_path[split_path.length - 1];
            if (appId.startsWith("id")) {
                let choppedAppId = appId.slice(2)
                return makeClaim(entity, APP_STORE_ID_CLAIM, choppedAppId, [], token, graphId);
            }
        }
    } else if (host.endsWith("goodreads.com")) {
        if (!(GOODREADS_BOOK_CLAIM in claims)) {
            // take whatever is before a . or -
            let bookId = split_path[split_path.length - 1].split(".")[0].split("-")[0];
            if (bookId && url.pathname.includes("/book/")) {
                return makeClaim(entity, GOODREADS_BOOK_CLAIM, bookId, [], token, graphId);
            }
        }
    } else if (host.endsWith("rottentomatoes.com")) {
        if (!(ROTTEN_TOM_CLAIM in claims)) {
            let workId = split_path[split_path.length - 1];
            let typeId = split_path[split_path.length - 2];
            if (workId && typeId) {
                return makeClaim(entity, ROTTEN_TOM_CLAIM, typeId + "/" + workId, [], token, graphId);
            }
        }
    } /*else if (host.endsWith("metacritic.com")) {
        if (!(METACRIT_CLAIM in claims)) {
            // slice off leading slash
            return makeClaim(entity, METACRIT_CLAIM, url.pathname.slice(1), [], token, graphId);
        }
    } */else if (host.endsWith("scholar.google.com")) {
        if (!(GOOGLE_SCHOLAR_CLAIM in claims)) {
            let userId = args.get("user");
            if (userId) {
                return makeClaim(entity, GOOGLE_SCHOLAR_CLAIM, userId, [], token, graphId);
            }
        }
    } else if (host.endsWith("itunes.apple.com")) {
        if (!(ITUNES_ARTIST_CLAIM in claims)) {
            let artistId = split_path[split_path.length - 1];
            let category = split_path[split_path.length - 3];
            let region = split_path[0];
            if (category == "artist" && region == "us") {
                return makeClaim(entity, ITUNES_ARTIST_CLAIM, artistId, [], token, graphId);
            }
        }
    } else {
        // fallback to wikidata
        for(let k of Object.keys(matchers)) {
            let matchData = matchers[k];
            let prop = matchData.prop;
            if (prop in claims || (prop in bannedProps)) {
                continue;
            }
            var mode = "";
            if (matchData.caseInsensitive) {
                mode = "i";
            }
            let regex = new RegExp(k, mode);
            let match = regex.exec(url.href);
            var key = matchData.replacementValue;
            if (match && match.length > 0) {
                for (var i = 1; i < match.length; i+=1) {
                    key = key.replaceAll("\\" + i, match[i]);
                }
                return makeClaim(entity, prop, key, [], token, graphId);
            }
        }
    }
    return Promise.resolve(null);
}

function processKB(id, claims, entityId, token) {
    if (id.startsWith("/m/")) {
        if (!(FREEBASE_CLAIM in claims)) {
            return makeClaim(entityId, FREEBASE_CLAIM, id, [], token, null);
        }
    } else if (id.startsWith("/g/")) {
        if (!(GOOGLE_KNOWLEDGE_CLAIM in claims)) {
            return makeClaim(entityId, GOOGLE_KNOWLEDGE_CLAIM, id, [], token, null);
        }
    }
    return Promise.resolve(null);
}

function processWebsite(website, claims, entityId, token, graphId) {
    if (website != null) {
        let websiteUrl = new URL(website);
        let host = websiteUrl.host;
        if (host.endsWith("twitter.com") ||
            host.endsWith("linkedin.com") ||
            host.endsWith("facebook.com") ||
            host.endsWith("youtube.com") ||
            host.endsWith("instagram.com")) {
        } else {
            if (!(WEBSITE_CLAIM in claims)) {
                return makeClaim(entityId, WEBSITE_CLAIM, website, [], token, graphId);
            }
        }
    }
    return Promise.resolve(null);
}

function processStockData(stockData, claims, entityId, token, graphId) {
    if (stockData.length) {
        if (!(STOCK_EXCHANGE_CLAIM in claims)) {
            let stock = stockData[0];
            let exchangeName = stock.exchange;
            let ticker = stock.ticker;
            let exchangeId = EXCHANGE_TO_ENTITY[exchangeName];
            let valueSnak = {"entity-type":"item","id": exchangeId}
            if (exchangeId) {
                let res = makeClaim(entityId, STOCK_EXCHANGE_CLAIM, valueSnak, [], token, graphId);
                return res.then(function(claim) {
                    let snakVal = ticker;
                    addQualifier(claim, TICKER_CLAIM, snakVal, token);
                });
            }
        }
    }
    return Promise.resolve(null);
}

chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
        let getToken = getCSRF();
        var getEntity = null
        if (request.url == "create!") {
            // first create the thing
            let token = await getToken;
            let name = request.name ? request.name : "";
            let desc = request.desc ? request.desc : "";
            let entityId = await makeItem(token, name, desc);
            getEntity = Promise.resolve(entityId);
        } else {
            let url = new URL(request.url);
            getEntity = getWikidataEntity(url);            
        }
        //getEntity = Promise.resolve("Q4115189");
        let graphId = request.graphId;
        let website = request.officialSite;
        let stockData = request.stockData;
        let socialMediaLinks = request.relatedUrls;
        let getMarkup = getEntity.then(function(entity){return getWikidataMarkup(entity);});

        Promise.all([getToken, getEntity, getMarkup]).then(function(res) {
            let token = res[0];
            let entityId = res[1];
            let markup = res[2];
            if (!entityId || !token || !markup) {
                return;
            }
            chrome.storage.local.get(entityId, function(pastResult) {
                var update = true;
                if (Object.entries(pastResult).length == 0) {
                    let claims = markup.entities[entityId].claims;
                    var promiseChain = Promise.resolve(null);
                    socialMediaLinks.forEach(function(url){
                        promiseChain = promiseChain.then(function(){return processSocialMediaUrl(url, claims, entityId, token, graphId);});
                    });
                    promiseChain = promiseChain.then(function(){return processKB(graphId, claims, entityId, token);});
                    promiseChain = promiseChain.then(function(){return processWebsite(website, claims, entityId, token, graphId);});
                    promiseChain = promiseChain.then(function(){return processStockData(stockData, claims, entityId, token, graphId);});
                    promiseChain = promiseChain.then(function(){
                        chrome.storage.local.set({[entityId]: 1});
                    });
                } else {
                    update = false;
                }
                let response = {entityId, update};
                chrome.tabs.sendMessage(sender.tab.id, response);
            });
        });
    });
