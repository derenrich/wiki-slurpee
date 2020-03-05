# wiki-slurpee
Browser extension for slurping Google knowledge graph data into Wikidata

**Warning: You should check all edits this extension produces. Google's data isn't perfect and nor is this extension. Major changes to Google's search results page will break this extension.**


Currently this extension can upload the following pieces of data to Wikidata:

* Facebook id
* Twitter id
* Instagram id
* Freebase id
* YouTube channel id
* Pinterest id
* Soundcloud id
* Google knowledge base id
* IMDB id
* Website URL


## Usage
To use this extension you should be logged in to Wikidata.

1. Find a google search result page with a knowledge panel that links to a Wikipedia article.

    ![Annotated info-box result](infobox.png)
    
2. Click the "slurp" button. This will attempt to upload Google's data to Wikidata. If there is a data conflict then the conflicted property is not updated.
3. If the edits were successful then it shows you a link to the Wikidata item and its history.

    ![Info-box result after edits](infobox_post.png)


## Errors

The extension can fail silently for a number of reasons:

* The Wikipedia article doesn't have a Wikidata entry
* The requests to Wikipedia failed (eg. due to throttling)
* You already tried to upload this data (this condition is caught and the data is not re-uploaded)
* If the Wikipedia has been deleted since Google crawled the page it will fail to find the Wikidata entry.