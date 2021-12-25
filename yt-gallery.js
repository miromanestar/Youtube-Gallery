/*
    Miro Manestar | December 25, 2021
    miroimanestar@gmail.com
    A simple script to display youtube playlists in a gallery.
*/

class YTGallery {
    constructor(id, key, el, opts = {}) {
        //Exit if the required parameters are left empty
        if (!(id && key && el)) {
            if (!id)
                console.error('No playlist ID set')
            if (!key)
                console.error('No api key set')
            if (!el)
                console.error('No container element ID set')
            
            return
        }

        //Set required parameters
        this.playlistId = id
        this.apiKey = key
        this.elId = el

        //Optional parameters
        this.numColumns = opts.numColumns || 3
        this.maxResults = opts.maxResults || 5
        this.searchEnabled = opts.searchEnabled || true
        this.cacheLife = opts.cacheLife || 86400000

        //Set state variables
        this.cacheName = `ytgallery-${ this.playlistId }`
        this.cache = localStorage[this.cacheName] ? JSON.parse(localStorage[this.cacheName]) : null
        this.playlistInfo = this.cache ? this.cache.playlistInfo : this.getPlaylistInfo()
        this.canPaginate = false
        this.currentPage = 1
        this.state = null

        this.elems = { container: document.querySelector(`#${ this.elId }`) }
        this.insert('div', 'gallery')
        this.insert('div', 'loader')
        this.checkCache()
    }

    checkCache = () => {
        if (!this.cache) {
            this.getPlaylistData()
            console.log(`Cache for \"${ this.cacheName }\" not found... building`)
            return
        }

        const time = Date.now()
        if (time - this.cache.time > this.cacheLife) {
            this.getPlaylistData()
            console.log(`Cache for \"${ this.cachename }\" is more than a day old... building`)
        } else {
            this.renderItems(this.getPageData())
            console.log(`Cache for \"${ this.cachename }\" is les than a day old... using cache`)
        }

    }

    // ------ API FUNCTIONS ------

    getPlaylistData = async (data, token) => {
        let videoIds = data || []

        let url = this.buildUrl('https://www.googleapis.com/youtube/v3/playlistItems', {
            key: this.apiKey,
            playlistId: this.playlistId,
            part: 'snippet',
            maxResults: 50,
            pageToken: token || ''
        })

        const res = await fetch(url).catch(error => {
            console.error(error, 'getPlaylistItems()')
        })

        data = await res.json()

        for (const item of data.items) {
            if (item.snippet.title !== 'Private video')
                videoIds.push(item.snippet.resourceId.videoId)
            else
                console.warn(`Video with ID \"${ item.snippet.resourceId.videoId }\" is private... skipping.`)
        }

        if (data.nextPageToken) {
            this.getPlaylistData(videoIds, data.nextPageToken)
        } else {
            console.log(`Playlist items successfully grabbed with ${ videoIds.length } items... grabbing item data.`);
            this.buildCache(videoIds)
        }
    }

    buildCache = async (videoIds, data, iteration = 0) => {
        let i = iteration + 1
        let ids = videoIds.slice((i - 1) * this.maxResults, i * this.maxResults)
        this.cache = data || ({
            playlistInfo: this.playlistInfo,
            time: Date.now(),
            numPages: 0,
            pages: [[]]
        })

        let url = this.buildUrl('https://www.googleapis.com/youtube/v3/videos', {
            key: this.apiKey,
            id: ids.toString(),
            part: 'snippet, contentDetails, statistics, recordingDetails, liveStreamingDetails',
            maxResults: 50
        })

        const res = await fetch(url).catch(error => {
            console.error(error, 'buildCache()')
        })

        data = await res.json()

        for (const item of data.items) {
            this.cache.pages[i - 1].push({
                title: item.snippet.title,
                description: item.snippet.description,
                date: this.getDate(item), //Grabs 1 of three possible date sources.
                thumbnail: item.snippet.thumbnails.medium.url,
                duration: this.parseIsoToDuration(item.contentDetails.duration, item.snippet.liveBroadcastContent),
                views: this.numberWithCommas(item.statistics.viewCount),
                id: item.id
            })
            this.cache.numPages = Math.ceil(videoIds.length / this.maxResults)

            if (this.currentPage === i)
                this.renderItems(this.getPageData(this.currentPage - 1))
        }

        if (i * this.maxResults < videoIds.length + 1) {
            this.cache.pages.push([])
            this.buildCache(videoIds, this.cache, i)
        } else {
            localStorage[this.cacheName] = JSON.stringify(this.cache)
        }

        console.log(`Page ${ i } data has been retrieved.`)
    }

    getPlaylistInfo = async () => {
        let url = this.buildUrl('https://www.googleapis.com/youtube/v3/playlists', {
            key: this.apiKey,
            id: this.playlistId,
            part: 'snippet',
        })

        const res = await fetch(url).catch(error => {
            console.error(error, 'getPlaylistInfo()')
        })

        const data = await res.json()

        return data
    }

    // ------ RENDERING FUNCTIONS ------

    renderItems = (items) => {
        const item = ({ title, date, thumbnail, duration, views, id }) => `
        <a class="ytgallery-video-container" data-fancybox href="https://www.youtube.com/watch?v=${ id }">
            <div class= "ytgallery-thumbnail-container">
                <img class="ytgallery-video-thumbnail" src="${ thumbnail }">
                <p class="ytgallery-video-duration">${ duration }<\/p>
            <\/div>
            <p class="ytgallery-video-title">${ title }<\/p>
            <i class="far fa-clock" id="ytgallery-date-icon" aria-hidden="true"><\/i><p class="ytgallery-video-date">${ date }<\/p>
            <p class="ytgallery-video-views">${ views }<\/p><i class="fa fa-eye" id="ytgallery-views-icon" aria-hidden="true"><\/i>
        <\/a>
        `;

        this.elems.gallery.innerHTML = items.map(item).join('')
    }

    insert = (el, name, parent) => {
        let temp = document.createElement(el)
        temp.classList.add(`ytgallery-${ name }`)
        this.elems[name] = temp

        if (!parent)
            this.elems.container.appendChild(temp)
        else
            parent.appendChild(temp)
    }

    // ------ UTILITY FUNCTIONS ------

    buildUrl = (link, opts) => {
        let url = new URL(link)
        url.search = new URLSearchParams(opts)
        return url
    }

    getPageData = (index) => {
        const pageRef = index || this.currentPage - 1
        return this.cache.pages[pageRef]
    }

    /*
    The recordingDate field can be manually set for each video, has highest precedence.
    actualStartTime denotes when, if a video has been livestreamed, it began streaming.
    publishedAt is the time at which the video was officially published.
    */
    getDate = (item) => {
        if (item.recordingDetails && item.recordingDetails.recordingDate != null) {
            return this.parseIsoToDate(item.recordingDetails.recordingDate)
        } else if (item.liveStreamingDetails && item.liveStreamingDetails.actualStartTime != null) {
            return this.parseIsoToDate(item.liveStreamingDetails.actualStartTime)
        } else if (item.liveStreamingDetails && item.liveStreamingDetails.scheduledStartTime != null) {
            return this.parseIsoToDate(item.liveStreamingDetails.scheduledStartTime)
        } else {
            return this.parseIsoToDate(item.snippet.publishedAt)
        }
    }

    logAjaxError = (ajaxResponse, msg) => {
        let response = JSON.parse(ajaxResponse.responseText)
        console.error(`${ msg } | Error ${ response.error.code }: ${ response.error.message }`)
    }

    parseIsoToDate = (s) => {
        const date = new Date(s)
        const year = date.getFullYear()
        const month = date.toLocaleString('default', { month: 'long' })
        const day = date.getUTCDate()

        return `${ month } ${ day }, ${ year }`
    }

    parseIsoToDuration = (duration, type) => {
        switch (type) {
            case 'live': return 'LIVE'
            case 'upcoming': return 'UPCOMING'
            default: break
        }

        var match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

        match = match.slice(1).map(function(x) {
            if (x != null)
                return x.replace(/\D/, '')
        })

        let hours = (parseInt(match[0]) || 0)
        let minutes = (parseInt(match[1]) || 0)
        if (minutes < 10 && minutes !== 0 && hours !== 0) { minutes = `0${ minutes }` }
        let seconds = (parseInt(match[2]) || 0)
        if (seconds < 10) { seconds = `0${ seconds }` }

        if (hours === 0)
             return `${ minutes }:${ seconds }`
        else
            return `${ hours}:${ minutes }:${ seconds }`
    }

    numberWithCommas = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
}