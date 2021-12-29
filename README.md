# Youtube-Gallery

Documentation coming soon...

Simple explanation:

```
new YTGallery(playlistId, apiKey, elementId)
```js

Where playlistId is the youtube playlist ID, apiKey is your youtube API key, and elementId is the id of the element in which you would like the gallery to display.

There's also fancybox support. All you need to do is include `fslightbox.js` and you're good to go.

YTGallery also takes a fourth parameter as an object, which includes optional parameters.

```
{
    numColumns, //Can be 1-4. Default: 3
    maxResults, //Can be 1-50. Default: 10
    searchEnabled, //Boolean to enable the search input. Default: true
    cacheLife, //In millseconds, specifies the max amount of time before the cache will be rebuild. Default: 86400000 (1 day)
}
```