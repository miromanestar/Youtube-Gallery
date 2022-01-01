/*
    Miro Manestar | December 31, 2021
    miroimanestar@gmail.com
    A simple script to display youtube playlists in a gallery.
*/

class YTGallery {
    constructor(id, key, el, opts = {}) {
        //Set required parameters
        this.playlistId = id
        this.apiKey = key
        this.elId = el

        //Exit if the required parameters are left empty
        if (!(id && key && el)) {
            let errMsg = ''

            if (!id)
               errMsg = 'No playlist ID set'
            if (!key)
                errMsg = 'No API key set'
            if (!el)
                errMsg = 'No container element ID set'
            
            this.handleError(errMsg, errMsg)
            return
        }

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
        this.prevSearch = []

        //SVG icons used the video containers
        this.eye = '<svg class="ytgallery-meta-icon" xmlns="http://www.w3.org/2000/svg" width="1792" height="1792" viewBox="0 0 1792 1792"><path d="M1664 960q-152-236-381-353 61 104 61 225 0 185-131.5 316.5t-316.5 131.5-316.5-131.5-131.5-316.5q0-121 61-225-229 117-381 353 133 205 333.5 326.5t434.5 121.5 434.5-121.5 333.5-326.5zm-720-384q0-20-14-34t-34-14q-125 0-214.5 89.5t-89.5 214.5q0 20 14 34t34 14 34-14 14-34q0-86 61-147t147-61q20 0 34-14t14-34zm848 384q0 34-20 69-140 230-376.5 368.5t-499.5 138.5-499.5-139-376.5-368q-20-35-20-69t20-69q140-229 376.5-368t499.5-139 499.5 139 376.5 368q20 35 20 69z"/></svg>'
        this.clock = '<svg class="ytgallery-meta-icon" xmlns="http://www.w3.org/2000/svg" width="1792" height="1792" viewBox="0 0 1792 1792"><path d="M1024 544v448q0 14-9 23t-23 9h-320q-14 0-23-9t-9-23v-64q0-14 9-23t23-9h224v-352q0-14 9-23t23-9h64q14 0 23 9t9 23zm416 352q0-148-73-273t-198-198-273-73-273 73-198 198-73 273 73 273 198 198 273 73 273-73 198-198 73-273zm224 0q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z"/></svg>'
        
        //Create elements
        this.elems = { container: document.querySelector(`#${ this.elId }`) }
        this.elems.container.onclick  = e => this.clickHandler(e)
        
        if (this.searchEnabled) {
            this.insert('input', 'search')
            let elem = this.elems.search
            elem.classList.add('ytgallery-search')
            elem.setAttribute('type', 'text')
            elem.setAttribute('placeholder', 'Search...')

            elem.oninput = e => this.search(e)

            this.hide(elem)
        }

        window.addEventListener('resize', e => this.styleColumns())

        this.insert('div', 'gallery')
        this.insert('div', 'loader')
        this.createButtons()
        this.checkCache()
    }

    checkCache() {
        if (!this.cache) {
            this.getPlaylistData()
            console.log(`Cache for \"${ this.cacheName }\" not found... building`)
            return
        }

        const time = Date.now()
        if (time - this.cache.time > this.cacheLife) {
            this.getPlaylistData()
            console.log(`Cache for \"${ this.cacheName }\" is more than a day old... building`)
        } else {
            this.renderItems(this.getPageData())
            console.log(`Cache for \"${ this.cacheName }\" is les than a day old... using cache`)
        }

    }

    // ------ API FUNCTIONS ------

    async getPlaylistData(data, token) {
        let videoIds = data || []

        let url = this.buildUrl('https://www.googleapis.com/youtube/v3/playlistItems', {
            key: this.apiKey,
            playlistId: this.playlistId,
            part: 'snippet',
            maxResults: 50,
            pageToken: token || ''
        })

        const res = await fetch(url).catch(error => {
            this.handleError(error, 'An issue occured while attempting to retrieve data from youtube')
            this.hide(this.elems.loader)
        })

        this.show(this.elems.loader)

        data = await res.json()

        if (data && data.error) {
            this.handleError(data.error, 'An issue occured while attempting to retrieve data from youtube.')
            this.hide(this.elems.loader)
            return
        }

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

    async buildCache(videoIds, data, iteration = 0) {
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
            this.handleError(error, 'An issue occured while attempting to retrieve data from youtube')
        })

        data = await res.json()

        if (data && data.error) {
            this.handleError(data.error, 'An issue occured while attempting to retrieve data from youtube.')
            this.hide(this.elems.loader)
            return
        }

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
            this.styleButtons()
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

    async getPlaylistInfo() {
        let url = this.buildUrl('https://www.googleapis.com/youtube/v3/playlists', {
            key: this.apiKey,
            id: this.playlistId,
            part: 'snippet',
        })

        const res = await fetch(url).catch(error => {
            this.handleError(error, 'An issue occured while attempting to retrieve data from youtube')
        })

        const data = await res.json()

        if (data && data.error) {
            this.handleError(data.error, 'An issue occured while attempting to retrieve data from youtube.')
            this.hide(this.elems.loader)
            return
        }

        return data
    }

    // ------ RENDERING FUNCTIONS ------

    renderItems(items) {
        const item = ({ title, date, thumbnail, duration, views, id }) => `
        <a class="ytgallery-video-container" data-fslightbox href="https://www.youtube.com/watch?v=${ id }">
            <div class= "ytgallery-thumbnail-container">
                <img class="ytgallery-video-thumbnail" src="${ thumbnail }" />
                <p class="ytgallery-video-duration">${ duration }</p>
            </div>
            <p class="ytgallery-video-title">${ title }</p>
            <div class="ytgallery-meta">
                <div>${ this.clock }<p class="ytgallery-meta-info">${ date }</p></div>
                <div>${ this.eye }<p class="ytgallery-meta-info">${ views }</p></div>
            </div>
        </a>
        `;

        this.elems.gallery.innerHTML = items.map(item).join('')
        this.hide(this.elems.loader)

        if (typeof refreshFsLightbox === 'function')
            refreshFsLightbox()

        if (this.searchEnabled)
            this.show(this.elems.search)

        this.styleButtons()
        this.styleColumns()
        this.okayToPaginate = true

        const distance = window.scrollY - this.elems.container.offsetTop
        if (distance >= 200)
            this.elems.container.scrollIntoView({
                behavior: 'smooth'
            })
    }

    insert(el, name, parent) {
        let temp = document.createElement(el)
        temp.classList.add(`ytgallery-${ name }`)
        this.elems[name] = temp

        if (!parent)
            this.elems.container.appendChild(temp)
        else
            parent.appendChild(temp)
    }

    createButtons() {
        let nextTop = document.createElement('div')
        nextTop.classList.add('ytgallery-btn')
        nextTop.innerHTML = 'Next'
        let backTop = nextTop.cloneNode()
        backTop.innerHTML = 'Back'
        let nextBottom = nextTop.cloneNode(true)
        let backBottom = backTop.cloneNode(true)

        let refresh = nextTop.cloneNode()
        refresh.innerHTML = 'Refresh'

        let top = document.createElement('div')
        top.classList.add('ytgallery-buttons')
        let bottom = top.cloneNode()
        let refreshCont = top.cloneNode()

        let infoTop = document.createElement('div')
        infoTop.classList.add('ytgallery-info')
        let infoBottom = infoTop.cloneNode()

        top.appendChild(backTop)
        top.appendChild(infoTop)
        top.appendChild(nextTop)

        bottom.appendChild(backBottom)
        bottom.appendChild(infoBottom)
        bottom.appendChild(nextBottom)

        refreshCont.appendChild(refresh)
        
        this.elems.container.appendChild(refreshCont)

        this.elems.gallery.before(top)
        this.elems.gallery.after(bottom)

        this.hide(top)
        this.hide(bottom)
        this.hide(refreshCont)

        this.elems.topButtons = top
        this.elems.bottomButtons = bottom

        this.elems.nextTop = nextTop
        this.elems.nextBottom = nextBottom
        this.elems.backTop = backTop
        this.elems.backBottom = backBottom

        this.elems.refresh = refreshCont
        
        this.elems.infoTop = infoTop
        this.elems.infoBottom = infoBottom
    }

    styleButtons() {
        const page = this.currentPage
        const pages = this.cache.numPages

        if (pages <= 1) {
            this.hide(this.elems.topButtons)
            this.hide(this.elems.bottomButtons)
        } else {
            this.show(this.elems.topButtons)
            this.show(this.elems.bottomButtons)
        }

        if (page === 1) {
            this.elems.backTop.classList.add('disabled')
            this.elems.backBottom.classList.add('disabled')
        } else {
            this.elems.backTop.classList.remove('disabled')
            this.elems.backBottom.classList.remove('disabled')
        }

        if (page === pages) {
            this.elems.nextTop.classList.add('disabled')
            this.elems.nextBottom.classList.add('disabled')
        } else {
            this.elems.nextTop.classList.remove('disabled')
            this.elems.nextBottom.classList.remove('disabled')
        }

        const pageText = `${ this.currentPage } of ${ this.cache.numPages }`
        this.elems.infoTop.innerHTML = pageText
        this.elems.infoBottom.innerHTML = pageText
        this.show(this.elems.refresh)
    }

    styleColumns() {
        const width = window.innerWidth

        if (this.numColumns === 4 && width >= 1410)
            this.setWidth('23%')
        else if (this.numColumns === 3 || width >= 1050)
            this.setWidth('31%')
        
        if (this.numColumns === 2 || width < 1050)
            this.setWidth('48%')
        if (this.numColumns === 1 || width <= 768)
            this.setWidth('100%')
    }

    //Set the width of all video items
    setWidth(width) {
        if (!this.elems.gallery)
            return

        for (let child of this.elems.gallery.children)
            child.style.width = width
    }

    hide(el) {
        el.style.display = 'none'
    }

    show(el) {
        el.style.display = ''
    }

    // ------ INPUT HANDLER FUNCTIONS ------
    
    paginate(dir) {
        if (this.okayToPaginate) {
            if (dir === 'Back' && this.currentPage === 1 || dir === 'Next' && this.currentPage === this.cache.numPages)
                    return

            this.okayToPaginate = false

            if (dir === 'Back' && this.getPageData(this.currentPage - 2) || dir === 'Next' && this.getPageData(this.currentPage).length > 0) {
                dir === 'Back' ? this.currentPage-- : this.currentPage++
                this.renderItems(this.getPageData())
            }
        }
    }

    refresh() {
        this.state = 'default'
        this.currentPage = 1
        this.elems.gallery.innerHTML = ''
        this.hide(this.elems.topButtons)
        this.hide(this.elems.bottomButtons)
        this.hide(this.elems.refresh)
        this.show(this.elems.loader)
        this.getPlaylistData()
    }

    search(e) {
        const val = e.target.value

        if (val === '' && this.state ==='search') {
            this.show(this.elems.loader)
            this.state = 'default'
            this.renderItems(this.getPageData())
            return
        }

        let results = []
        for (const page of this.cache.pages) {
            for (const item of page) {
                if (item.title.toLowerCase().includes(val) || item.date.toLowerCase().includes(val))
                    results.push(item)
            }
        }

        if (results.length < this.maxResults && results.length > 0) {
            this.show(this.elems.loader)
            this.hide(this.elems.topButtons)
            this.hide(this.elems.bottomButtons)
            this.state = 'search'
            this.renderItems(results)
        }
    }

    clickHandler(e) {
        if (e.target.matches('.ytgallery-btn')) {
            switch (e.target.innerHTML) {
                case 'Next': this.paginate('Next'); break;
                case 'Back': this.paginate('Back'); break;
                case 'Refresh': this.refresh(); break;
                default: break;
            }
        }
    }

    // ------ UTILITY FUNCTIONS ------

    buildUrl(link, opts) {
        let url = new URL(link)
        url.search = new URLSearchParams(opts)
        return url
    }

    getPageData(index) {
        const pageRef = index || this.currentPage - 1
        return this.cache.pages[pageRef]
    }

    /*
        The recordingDate field can be manually set for each video, has highest precedence.
        actualStartTime denotes when, if a video has been livestreamed, it began streaming.
        publishedAt is the time at which the video was officially published.
    */
    getDate(item) {
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

    parseIsoToDate(s) {
        const date = new Date(s)
        const year = date.getFullYear()
        const month = date.toLocaleString('default', { month: 'long' })
        const day = date.getUTCDate()

        return `${ month } ${ day }, ${ year }`
    }

    parseIsoToDuration(duration, type) {
        switch (type) {
            case 'live': return 'LIVE'
            case 'upcoming': return 'UPCOMING'
            default: break
        }

        let match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

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

    numberWithCommas(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }

    handleError(error, msg) {
        console.error(error)

        if (this.elems) {
            this.elems.gallery.innerHTML = msg
            this.hide(this.elems.bottomButtons)
            this.hide(this.elems.topButtons)
            this.show(this.elems.refresh)
            
            if (this.searchEnabled)
                this.hide(this.elems.search)
        } else if (this.elId) {
            document.getElementById(this.elId).innerHTML = `
                <div class="ytgallery-error">
                ${ msg }
                </div>
            `
        }
    }
}