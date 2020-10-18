import { Source, Manga, MangaStatus, Chapter, ChapterDetails, HomeSectionRequest, HomeSection, MangaTile, SearchRequest, LanguageCode, TagSection, Request, MangaUpdates, SourceTag, TagType, PagedResults } from "paperback-extensions-common"
const AM_DOMAIN = 'https://akumanga.com'

export class AkuManga extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.1.0' }
  get name(): string { return 'AkuManga' }
  get description(): string { return 'موقع ترجمة المانجا العربية' }
  get author(): string { return 'Conrad Weiser' }
  get authorWebsite(): string { return 'https://github.com/conradweiser' }
  get icon(): string { return "logo.png" }
  get hentaiSource(): boolean { return false }
  getMangaShareUrl(mangaId: string): string | null { return `${AM_DOMAIN}/manga/${mangaId}` }
  get sourceTags(): SourceTag[] { return [{ text: "Arabic", type: TagType.GREY }] }
  get rateLimit(): Number {
    return 2
  }
  get websiteBaseURL(): string { return AM_DOMAIN }

  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${AM_DOMAIN}/manga/${id}/`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let $ = this.cheerio.load(data)

    let titles: string[] = []

    let tags: TagSection[] = [createTagSection({ id: '0', label: 'genre', tags: [] })]

    let profileContext = $('div.profile-manga')
    let image = $('img', $('div.summary_image', $(profileContext))).attr('src')

    let status = $('.summary-content', $('div.post-status', $(profileContext)).toArray()[1]).text()
    let description = $('p', $('div.description-summary')).text().trim()

    let rating = Number($('span.total_votes', $('div.post-total-rating')).text()) ?? 0

    let author, artist

    let i = 0
    let containerDetails = $('.post-content_item', $(profileContext)).toArray()
    for(let obj of containerDetails) {
        switch(i) {
            case 0: {
                // Rating
                i++ 
                continue
            }
            case 1: {
                // Views
                i++
                continue
            }
            case 2: {
                // Other titles
                let otherTitles = $('div.summary-content', $(obj)).text()
                for (let title of otherTitles.split(',')) {
                    titles.push(title.trim())
                }
                i++
                continue
            }
            case 3: {
                // Author
                author = $('a', $('.author-content', $(obj))).text().trim()
                i++
                continue
            }
            case 4: {
                // Artist? I have no clue what this section is. "Painter" seems like artist though
                artist = $('.artist-content', $(obj)).text().trim()
                i++
                continue
            }
            case 5: {
                // Category
                for(let genre of $('a', $('.genres-content', $(obj))).toArray()) {
                    tags[0].tags.push(createTag({label: $(genre).text().trim(), id: $(genre).text().trim()}))
                }
            }
        }
    }

    return [createManga({
        id: metadata.id,
        titles: titles,
        image: image!,
        rating: rating,               // Fix this
        status: MangaStatus.ONGOING,    // This too
        langFlag: 'AR',
        langName: "Arabic",
        artist: artist,
        author: author,
        tags: tags,
        desc: description
    })]
    

  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${AM_DOMAIN}/manga/${mangaId}`,
      metadata: metadata,
      method: 'GET'
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    for(let obj of $('ul.version-chap', $('div.page-content-listing')).toArray()) {

        let id = $('a', $('li.wp-manga-chapter', $(obj))).attr('href')?.replace(/\D/g, '')

        // This ID is the highest chapter value we have. Iteratively get all of the others
        for(let i = 1; i <= Number(id); i++) {
            chapters.push(createChapter({
                id: String(i),
                mangaId: metadata.id,
                chapNum: i,
                langCode: LanguageCode.UNKNOWN     // Are we missing an arabic language code?
            }))
        }
    }

    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {

    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${AM_DOMAIN}/manga/${mangaId}/${chapId}/`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)
    let pages: string[] = []

    for(let obj of $('.page-break').toArray()) {
        let url = $('img', $(obj)).attr('src')!
        pages.push(url.substr(url.search('https://')))
    }

    return createChapterDetails({
        id: metadata.chapterId,
        mangaId: metadata.mangaId,
        pages: pages,
        longStrip: true
    })

  }


  searchRequest(query: SearchRequest): Request | null {

    let title = query.title?.replace(" ", "+")

    return createRequestObject({
      url: `${AM_DOMAIN}/?s=${title}&post_type=wp-manga&op=&author=&artist=&release=&adult=`,
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any, metadata: any): PagedResults {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    for(let obj of $('div.row', $('div.tab-content-wrap')).toArray()) {
        let image = $('img', $(obj)).attr('src')
        let title = $('a', $('h3', $('div.post-title', $(obj)))).text().trim()
        let id = $('a', $('h3', $('div.post-title', $(obj)))).attr('href')!.replace(`${AM_DOMAIN}/manga/`, '').replace('/', '')

        mangaTiles.push(createMangaTile({
            id: id,
            title: createIconText({text: title}),
            image: image!
        }))
    }

    return createPagedResults({
        results: mangaTiles
    })
  }

  getHomePageSectionRequest(): HomeSectionRequest[] {
    let request = createRequestObject({ url: `${AM_DOMAIN}`, method: 'GET' })
    let section1 = createHomeSection({ id: 'most_watched', title: 'الاكثر مشاهدة' })
    let section2 = createHomeSection({ id: 'latest_manga', title: 'أخر المانجا المضافة' })

    return [createHomeSectionRequest({ request: request, sections: [section1, section2] })]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let $ = this.cheerio.load(data)
    let mostWatched: MangaTile[] = []
    let latestManga: MangaTile[] = []

    // Latest manga section
    for(let obj of $('div.page-listing-item', $('div.manga_content')).toArray()) {
        // Each obj has 2 objects, a row
        for(let item of $('.page-item-detail', $(obj)).toArray()) {
            let image = $('img', $(item)).attr('src')
            let title = $('a', $(item)).attr('title')
            let id = $('a', $(item)).attr('href')!.replace(`${AM_DOMAIN}/manga/`, '').replace('/', '')

            latestManga.push(createMangaTile({
                image: image!,
                id: id,
                title: createIconText({text: String(title)})
            }))
        }
    }

    // Most watched section
    for(let obj of $('.popular-item-wrap').toArray()) {
        let image = $('img', $(obj)).attr('src')
        let title = $('a', $(obj)).attr('title')
        let id = $('a', $(obj)).attr('href')!.replace(`${AM_DOMAIN}/manga/`, '').replace('/', '')

        mostWatched.push(createMangaTile({
            image: image!,
            id: id,
            title: createIconText({text: String(title)})
        }))
    }

    sections[0].items = mostWatched
    sections[1].items = latestManga
    return sections
  }
}