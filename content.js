console.log("booting content script...");

var panelClassNames = ["kp-wholepage","knowledge-panel"];
var booted;

function getKnowledgePanel() {
    function tryGetPanel(className) {
        let panels = document.getElementsByClassName(className);
        if (panels.length > 0) { // sometimes there are multiple boxes
            let panel = panels[0]; // just get the first one
            if(!panel.getElementsByTagName("wholepage-tab-history-helper").length) {
                return panels[0];
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    let panels = panelClassNames.map(className => tryGetPanel(className)).filter(panel => panel != null);
    if (panels.length > 0) { // sometimes there are multiple boxes
        return panels[0]; // just get the first one
    } else {
        let backupPanel = getKnowledgePanelBackup();
        if (backupPanel) {
            return backupPanel;
        } else {
            console.log("Failed to find the knowledge-panel")
            return null;
        }
    }
}

function getKnowledgePanelBackup() {
    let panel = document.querySelector("div[data-attrid=\"kc:/ugc:thumbs_up\"]");
    if (panel) {
        return panel.parentElement.parentElement.parentElement.parentElement;
    } else {
        return null;
    }
}

function getHeader() {
    let panel = getKnowledgePanel();
    let container = panel.querySelector("div#wp-tabs-container");
    if (container) {
        return container
    }
    let container2 = panel.querySelector("div.kp-header");
    if (container2) {
        return container2;
    }
    return panel;
}

function getWikipediaLink() {
    console.log("no wikipedia link found...doing fallback");
    let searchBox = document.getElementById("search");
    let links = Array.from(searchBox.getElementsByTagName("a"));
    let wiki_links = links.filter(a => a.host.includes("wikipedia"));

    wiki_links.forEach(a => {
        let wikiHref = a.href;
        a.href = "#";
        a.ping = "#";
        a.onclick = function() {
            postData(wikiHref);
        }
    });
    let panel = getKnowledgePanel();
    let header = getHeader();
    let center = document.createElement("center");
    center.innerText = "click on wikipedia link you want to use";
    header.prepend(center);

    let center2 = document.createElement("center");
    let create = document.createElement("a");
    create.innerText = "create!";
    create.href= "#";
    center2.prepend(create);
    create.onclick = function() {
        doCreate();
    }
    header.prepend(center2);
   
}
function doCreate() {
    let info = getInfo();
    info["url"] = "create!";
    console.log(info);
    chrome.runtime.sendMessage(info);
}

function getGameData(panel) {
    let gameBox = panel.querySelector("[data-attrid='kc:/cvg/computer_videogame:reviews']");
    if (gameBox) {
        let gameLinks = gameBox.getElementsByTagName("a");
        return Array.from(gameLinks).map(a => a.href).filter(href => href && !href.includes("facebook"));
    }
    return [];
}

function getBookData(panel) {
    let gameBox = panel.querySelector("[data-attrid='kc:/book/book:reviews']");
    if (gameBox) {
        let gameLinks = gameBox.getElementsByTagName("a");
        return Array.from(gameLinks).map(a => a.href).filter(href => href);
    }
    return [];
}

function getFilmData(panel) {
    let filmBox = panel.querySelector("[data-attrid='kc:/film/film:reviews']");
    if (filmBox) {
        let filmLinks = filmBox.getElementsByTagName("a");
        return Array.from(filmLinks).map(a => a.href).filter(href => href && !href.includes("facebook"));
    }
    let tvBox = panel.querySelector("[data-attrid='kc:/tv/tv_program:reviews']");
    if (tvBox) {
        let tvLinks = tvBox.getElementsByTagName("a");
        return Array.from(tvLinks).map(a => a.href).filter(href => href && !href.includes("facebook"));        
    }
    return [];
}

function getArtistData(panel){
    let availableOn = panel.querySelector("[data-attrid='action:listen_artist']");
    if (availableOn) {
        let artistLinks = Array.from(availableOn.getElementsByTagName("a"))
            .map(a => a.href)
            .filter(href => href.length > 0)
            .filter(href => !href.includes("youtube.com"));
        return artistLinks;
    } else {
        return  [];
    }
}

function getWatchData(panel) {
    let watch = panel.querySelector("[data-attrid='kc:/tv/tv_program:media_actions_wholepage']") || panel.querySelector("[data-attrid='kc:/film/film:media_actions_wholepage']");
    if (watch) {
        let watchLinks = Array.from(watch.getElementsByTagName("a"))
            .map(a => a.href)
            .filter(href => href.length > 0)
            .filter(href => !href.includes("youtube.com"));
        return watchLinks;
    } else {
        return [];
    }
}

function getStockData(panel) {
    let stock = panel.querySelector("[data-attrid='kc:/business/issuer:stock quote']");
    if (stock) {
        let block = Array.from(stock.getElementsByClassName("kno-fv"))[0];
        let ticker = block.children[0].text;
        let exchange = block.children[1].innerText.slice(1,-1);
        let stockData = {ticker, exchange}
        return [stockData];
    } else {
        return [];
    }
}

function getName(panel) {
    let title = panel.querySelector("[data-attrid='title']");
    if (title) {
        return title.innerText;
    } else {
        return null;
    }
}

function getDesc(panel) {
    let subtitle = panel.querySelector("[data-attrid='subtitle']");
    if (subtitle) {
        return subtitle.innerText;
    } else {
        return null;
    }
}

function getWikiLinkDirectly() {
    console.log("scraping panel");
    let panel = getKnowledgePanel();
    if (panel != null) { 
        let desc = panel.getElementsByClassName("kno-rdesc")[0];
        if (desc) {
            let links = desc.getElementsByTagName("a");
            if (links.length == 1) { 
                let link = links[0];
                if (link.innerText == "Wikipedia") {
                    let url = link.href;
                    return url;
                }
            }
        }
        getWikipediaLink();
        return;
    }
}

function getInfo() {
    let panel = getKnowledgePanel();
    if (panel != null) { 
        let socialMediaBox = panel.querySelector("[data-attrid='kc:/common/topic:social media presence']");
        var socialMediaUrls = [];
        if (socialMediaBox != null) {
            let socialMediaLinks = socialMediaBox.getElementsByTagName("a");
            socialMediaUrls = Array.from(socialMediaLinks).map(a => a.href);
        }

        let filmLinks = getFilmData(panel);
        let bookLinks = getBookData(panel);
        let gameLinks = getGameData(panel);
        let artistLinks = getArtistData(panel);
        let watchLinks = getWatchData(panel);
        let stockData = getStockData(panel);
        let name = getName(panel);
        let desc = getDesc(panel);
        let officialSiteElement = panel.querySelector("[data-attrid='visit_official_site']");
        var officialSite = null;
        if (officialSiteElement != null) {
            officialSite = officialSiteElement.href;
        }        
        try {
            let footer = panel.parentElement.getElementsByClassName("kno-ftr")[0];
            let claimLink = new URL(footer.getElementsByTagName("a")[0].href);
            var graphId = claimLink.search.slice(5).split("&")[0];
            if (graphId.startsWith("/g/") || graphId.startsWith("/m/")) {
                console.debug("found graph id of " + graphId);
            } else {
                // failed to parse knowledge id
                console.error("failed to parse knowledge id");
                graphId = "";
            }
        } catch (ex) {
            graphId = "";
        }
        let relatedUrls = filmLinks.concat(socialMediaUrls).concat(artistLinks).concat(gameLinks).concat(bookLinks).concat(watchLinks);
        return {
            name,
            desc,
            graphId,
            relatedUrls,
            officialSite,
            stockData
        };
    }
}

function postData(wikiUrl) {
    let info = getInfo();
    info["url"] = wikiUrl;
    console.log(info);
    chrome.runtime.sendMessage(info);
}

function handleResponse(response, sender, sendResponse) {
    let panel = getKnowledgePanel();
    let header = getHeader();
    let center = document.createElement("center");
    if ("entityId" in response) {
        let link = document.createElement('a');
        let historyLink = document.createElement('a');
        link.setAttribute('target','_blank');
        historyLink.setAttribute('target','_blank');
        link.href = `https://www.wikidata.org/wiki/${response.entityId}`;
        link.innerText = response.entityId;
        historyLink.href = `https://www.wikidata.org/w/index.php?title=${response.entityId}&action=history`;
        historyLink.innerText = " [history]";
        center.append(link);
        center.append(historyLink);
        center.append(document.createElement('br'));
        if (!response.update) {
            center.append(document.createElement('br'));
            let text = document.createElement("span");
            text.innerText = "<result cached, nothing written>";
            center.append(text);
            center.append(document.createElement('br'));
        }
    }
    if (header) {
        header.prepend(center);
    }
}

if (!booted) {
    chrome.runtime.onMessage.addListener(handleResponse);
    booted = true;
}

var wikiLink = getWikiLinkDirectly();
if (wikiLink != null) {
    postData(wikiLink);
}
