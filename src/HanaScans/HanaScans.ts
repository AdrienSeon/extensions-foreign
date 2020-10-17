import { Source, Manga, MangaStatus, Chapter, ChapterDetails, HomeSectionRequest, HomeSection, MangaTile, SearchRequest, LanguageCode, TagSection, Request, MangaUpdates, SourceTag, TagType, PagedResults } from "paperback-extensions-common"
const HS_DOMAIN = 'https://hanascan.com'

export class HanaScans extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.3.1' }
  get name(): string { return 'HanaScan' }
  get description(): string { return 'RAWコンテンツ' }
  get author(): string { return 'Various Developers' }
  get authorWebsite(): string { return 'http://github.com/chyyran' }
  get icon(): string { return "logo.png" }
  get hentaiSource(): boolean { return false }
  getMangaShareUrl(mangaId: string): string | null { return `${HS_DOMAIN}/${mangaId}.html` }
  get sourceTags(): SourceTag[] { return [{ text: "Japanese", type: TagType.GREY }] }
  get rateLimit(): Number {
    return 2
  }
  get websiteBaseURL(): string { return HS_DOMAIN }

  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${HS_DOMAIN}/${id}.html`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let $ = this.cheerio.load(data)

    let titles: string[] = []
    let author

    let tags: TagSection[] = [createTagSection({ id: '0', label: 'genre', tags: [] })]
    let status: MangaStatus = MangaStatus.ONGOING   // Default to ongoing
    let views
    let lang
    let breadcrumbContext = $('li', $('.breadcrumb')).toArray()?.[2];
    let title = $('span', breadcrumbContext).text()
      .replace("- Raw", "").trim() ?? ''
    titles.push(title)
    let image = $('img', breadcrumbContext).attr('src')

    lang = LanguageCode.JAPANESE

    let objContext = $('li', $('.manga-info')).toArray()
    for (let i = 0; i < objContext.length; i++) {
      switch (i) {
        case 0: {
          const _titles = $(objContext[i])?.text()?.replace("Other names: ", "")?.trim()?.split(',')
          if (!_titles) break;
          for (let title of $(objContext[i]).text().replace("Other names: ", "").trim().split(',')) {
            titles.push(title.trim())
          }
          break;
        }
        case 1: {
          author = $('a', $(objContext[i])).text() ?? ''
          break;
        }
        case 2: {
          for (let obj of $('a', $(objContext[i]).toArray()).toArray()) {
            let text = $(obj).text()
            tags[0].tags.push(createTag({ label: text, id: text }))
          }
          break;
        }
        case 3: {
          let text = $('a', $(objContext[i])).text()
          status = text.includes("Ongoing") ? MangaStatus.ONGOING : MangaStatus.COMPLETED
          break;
        }
        case 4: {
          views = $(objContext[i]).text().replace(" Views: ", "") ?? ''
          break;
        }
      }
    }

    let rowContext = $('.row', $('.well-sm')).toArray()
    let description = $('p', $(rowContext[1])).text()

    let rating = $('.h0_ratings_active', $('.h0rating')).toArray().length

    return [createManga({
      id: metadata.id,
      titles: titles,
      image: image!,
      status: status,
      desc: description,
      tags: tags,
      author: author,
      rating: rating,
      langFlag: lang,
      langName: lang,
      views: views ? Number.parseInt(views, 10) : undefined,
      hentai: false            // This is an 18+ source
    })]

  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    mangaId = mangaId.replace(".html", "")
    return createRequestObject({
      url: `${HS_DOMAIN}/${mangaId}.html`,
      metadata: metadata,
      method: 'GET'
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    let lang = LanguageCode.JAPANESE

    for (let obj of $('p', $('#list-chapters')).toArray().reverse()) {
      let id = $('.chapter', $(obj)).attr('href')
      let name = $('b', $(obj)).text().trim()

      //TODO Add the date calculation into here
      let timeStr = /(\d+) ([hours|weeks|months]+) ago/.exec($('time', $(obj)).text().trim())
      let date = new Date()
      if (timeStr) {

        switch (timeStr[2]) {
          case 'hours': {
            // Do nothing, we'll just call it today
            break;
          }
          case 'weeks': {
            date.setDate(date.getDate() - (Number(timeStr[1])) * 7)
            break;
          }
          case 'months': {
            date.setDate(date.getDate() - (Number(timeStr[1])) * 31)  // We're just going to assume 31 days each month I guess. Can't be too specific 
            break;
          }
        }
      }


      chapters.push(createChapter({
        id: id!,
        mangaId: metadata.id,
        chapNum: Number.parseFloat(name?.match(/(?:- Raw Chap )([\d\.]+$)/)?.[1] ?? '0'),
        langCode: lang ?? LanguageCode.UNKNOWN,
        name: name,
        time: date
      }))
    }

    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {

    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${HS_DOMAIN}/${chapId}.html`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)
    let pages: string[] = []

    for (let obj of $('img.chapter-img', $('.chapter-content')).toArray()) {
      pages.push($(obj).attr('src')!.trim())
    }

    metadata.chapterId = metadata.chapterId.replace(".html", "")
    metadata.chapterId = metadata.chapterId.replace(/-chapter-\d/g, "")
    metadata.chapterId = metadata.chapterId.replace("read", "manga")

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
      url: `${HS_DOMAIN}/manga-list.html?m_status=&author=&group=&name=${title}&genre=&ungenre=`,
      timeout: 4000,
      method: "GET"
    })
  }

  // TODO: This needs updated to actually make use of paged results
  search(data: any, metadata: any): PagedResults {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    for (let obj of $('.row.top').toArray()) {
      let title = $('a', $('.media-heading', $(obj))).text() ?? ''
      let id = $('a', $('.media-heading', $(obj))).attr('href')
      if (!id) {
        continue;
      }
      let img = $('img', $(obj)).attr('data-original') ?? ''
      let textContext = $('.media-body', $(obj))
      let primaryText = createIconText({ text: $('span', textContext).text() })

      id = id.replace(".html", "")

      mangaTiles.push(createMangaTile({
        title: createIconText({ text: title }),
        id: id,
        image: img,
        primaryText: primaryText
      }))
    }

    return createPagedResults({
      results: mangaTiles
    })
  }

  getHomePageSectionRequest(): HomeSectionRequest[] {
    let request = createRequestObject({ url: `${HS_DOMAIN}`, method: 'GET' })
    let section1 = createHomeSection({ id: 'latest_release', title: 'Latest Manga Releases' })
    let section2 = createHomeSection({ id: 'hot_manga', title: 'Top Hot Today' })

    return [createHomeSectionRequest({ request: request, sections: [section1, section2] })]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let $ = this.cheerio.load(data)
    let latestManga: MangaTile[] = []
    let hotManga: MangaTile[] = []

    let context = $('#contentstory')?.toArray()?.[0]
    for (let item of $('.itemupdate', $(context))?.toArray() ?? []) {
      let id = $('a', $(item)).attr('href')?.replace(".html", "")
      if (!id) {
        continue;
      }

      let titleText = $('.title-h3', $(item)).text()
        ?.replace('- Raw', '')
        ?.replace('- RAW', '')
        ?.replace('(Manga)', '')?.trim()
      if (!titleText) {
        continue;
      }

      let title = createIconText({
        text: titleText
      })
      let image = $('.lazy', $(item)).attr('data-original') ?? ''
      let views = $('.view', $(item))?.text() ?? 0

      latestManga.push(createMangaTile({
        id: id,
        title: title,
        image: image,
        primaryText: createIconText({ text: String(views) })
      }))
    }

    sections[0].items = latestManga

    let hotContext = $('.topday').toArray()[0]
    for (let item of $('.item', $(hotContext))?.toArray() ?? []) {
      let id = $('a', $(item)).attr('href')?.replace(".html", "")
      if (!id) { continue; }

      let titleText = $('h3', $(item))?.text()
        ?.replace('- Raw', '')
        ?.replace('- RAW', '')
        ?.replace('(Manga)', '')
        ?.trim();
      if (!titleText) {
        continue;
      }

      let title = createIconText({
        text: titleText
      })

      let image = $('.owl-lazy', $(item)).attr('data-src') ?? ''

      hotManga.push(createMangaTile({
        id: id,
        title: title,
        image: image,
      }))
    }

    sections[1].items = hotManga

    return sections
  }

  requestModifier(request: Request): Request {

    let headers: any = request.headers == undefined ? {} : request.headers
    headers['Referer'] = `${HS_DOMAIN}`

    return createRequestObject({
      url: request.url,
      method: request.method,
      headers: headers,
      data: request.data,
      metadata: request.metadata,
      timeout: request.timeout,
      param: request.param,
      cookies: request.cookies,
      incognito: request.incognito
    })
  }
}