# Youtube Gallery
### No jQuery, no Bootstrap

A while ago, I made a youtube gallery viewer. It worked pretty well, save for several major problems.
- The first of which was that it polluted the global namespace. `var` was being used everywhere and everythingw as defined globally.
- Second, you could only have one active instance per page at a time as a consequence, since they would all override each other.
- Third, it required explicit HTML to be created by the user. This was annoying and was also part of the reason you could only have one active instance per page, since the element IDs used for event triggers would conflict.
- Fourth, it relied on jQuery to work.

This new version solves all those problems. Now, it is initialized entirely programmatically, save for one empty HTML element with an ID provided so that the gallery knows where to place itself in the DOM.
It makes absolutely zero use of jQuery, and has no required external dependencies. Everything is encapsulated in a class, and nothing except the primary container utilizes elemnt IDs. Thus, you can have as many instances as required without issue.
Finally, it's also much easier to use, as shown below.

## How to use
```js
new YTGallery(playlistId, apiKey, elementId)
```

Where playlistId is the youtube playlist ID, apiKey is your youtube API key, and elementId is the id of the element in which you would like the gallery to display.

There's also fancybox support. All you need to do is include `fslightbox.js` and you're good to go.

YTGallery also takes a fourth parameter as an object which includes optional parameters.

```js
{
    numColumns, //Can be 1-4. Default: 3
    maxResults, //Can be 1-50. Default: 10
    searchEnabled, //Boolean to enable the search input. Default: true
    cacheLife, //In millseconds, specifies the max amount of time before the cache will be rebuild. Default: 86400000 (1 day)
}
```

## Demo
You can see it on my website [here](https://miromanestar.com/projects/ytgallery) or play with it using your own API key [here](https://miromanestar.github.io/Youtube-Gallery/).

## Dependencies
There are no absolute dependencies, but check out [fslightbox](https://fslightbox.com/) to enable ligthbox automatically.

## Future Plans
I'm thinking of adding my own ligthbox functionality to this so as to remove any external dependencies whatsoever.
Furthermore, custom rendering options are also something I'm considering.
