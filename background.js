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
    let wiki_article_name = split_url[split_url.length - 1];
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
            css: ["div.knowledge-panel"]
        })
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()]
      }]);
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

let IMDB_CLAIM = "P345";


function makeClaim(entity, property, value, rawTags, rawToken) {
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
    }).then(function(data){return data.json();}).then(function(data){return addRef(data, rawToken);});
}


function addRef(data, rawToken) {
    let base_url = "https://www.wikidata.org/w/api.php?action=wbsetreference&format=json&";
    let token = encodeURIComponent(rawToken);
    let summary = encodeURIComponent("scraped data from google");
    let snaks =  encodeURIComponent(JSON.stringify({"P248":[{"snaktype":"value","property":"P248","datavalue":{"type":"wikibase-entityid","value":{"id":"Q648625"}}}]}));

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
        });
    }
    return Promise.resolve(null);
}

function processSocialMediaUrl(stringUrl, claims, entity, token) {
    let url = new URL(stringUrl);
    let host = url.host;
    let split_path = url.pathname.split("/");
    if (host.endsWith("twitter.com")) {
        if (!(TWITTER_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            return makeClaim(entity, TWITTER_CLAIM, handle, [], token);
        }
    } else if (host.endsWith("instagram.com")) {
        if (!(INSTA_CLAIM in claims)) {
            var handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, INSTA_CLAIM, handle, [], token);                
        }
    } else if (host.endsWith("pinterest.com")) {
        if (!(PINTEREST_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }                                
            return makeClaim(entity, PINTEREST_CLAIM, handle, [], token);                                
        }
    } else if (host.endsWith("facebook.com")) {
        if (!(FB_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }                
            return makeClaim(entity, FB_CLAIM, handle, [], token);                                
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
                return makeClaim(entity, YT_CLAIM, handle, [], token);                                
            }
        }
    } else if (host.endsWith("soundcloud.com")) {
        if (!(SOUND_CLOUD_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, SOUND_CLOUD_CLAIM, handle, [], token);
        }
    } else if (host.endsWith("myspace.com")) {
        if (!(MY_SPACE_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, MY_SPACE_CLAIM, handle, [], token);
        }
    } else if (host.endsWith("imdb.com")) {
        if (!(IMDB_CLAIM in claims)) {
            let handle = split_path[split_path.length - 1];
            if (handle == "") {
                handle = split_path[split_path.length - 2];
            }
            return makeClaim(entity, IMDB_CLAIM, handle, [], token);                
        }
    }
    return Promise.resolve(null);
}

function processKB(id, claims, entityId, token) {
    if (id.startsWith("/m/")) {
        if (!(FREEBASE_CLAIM in claims)) {
            return makeClaim(entityId, FREEBASE_CLAIM, id, [], token);
        }
    } else if (id.startsWith("/g/")) {
        if (!(GOOGLE_KNOWLEDGE_CLAIM in claims)) {
            return makeClaim(entityId, GOOGLE_KNOWLEDGE_CLAIM, id, [], token);
        }
    }
    return Promise.resolve(null);
}

function processWebsite(website, claims, entityId, token) {
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
                return makeClaim(entityId, WEBSITE_CLAIM, website, [], token);
            }
        }
    }
    return Promise.resolve(null);
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        let url = new URL(request.url);
        let graphId = request.graphId;
        let website = request.officialSite;
        let socialMediaLinks = request.relatedUrls;
        let getToken = getCSRF();
        let getEntity = getWikidataEntity(url);
        let getMarkup = getEntity.then(function(entity){return getWikidataMarkup(entity);});


        Promise.all([getToken, getEntity, getMarkup]).then(function(res) {
            let token = res[0];
            let entityId = res[1];
            let markup = res[2];

            chrome.storage.local.get(entityId, function(pastResult) {
                console.log(pastResult);
                var update = true;
                if (Object.entries(pastResult).length == 0) {
                    let claims = markup.entities[entityId].claims;
                    var promiseChain = Promise.resolve(null);
                    socialMediaLinks.forEach(function(url){
                        promiseChain = promiseChain.then(function(){return processSocialMediaUrl(url, claims, entityId, token);});
                    });
                    promiseChain = promiseChain.then(function(){return processKB(graphId, claims, entityId, token);});
                    promiseChain = promiseChain.then(function(){return processWebsite(website, claims, entityId, token);});
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
