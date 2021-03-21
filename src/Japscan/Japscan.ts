import { Source, Manga, Chapter, ChapterDetails, HomeSection, SearchRequest, PagedResults, SourceInfo, TagType, MangaUpdates } from "paperback-extensions-common";
import { isLastPage, parseChapterDetails, parseChapters, parseMangaDetails, parseSearchResults, UpdatedManga, parseUpdatedManga } from "./JapscanParser";

export const JS_DOMAIN = "https://www.japscan.se";

export const MyReadingMangaInfo: SourceInfo = {
	version: "1.0.0",
	name: "Japscan",
	icon: "icon.png",
	author: "Ankah",
	authorWebsite: "https://github.com/AdrienSeon",
	description: "Extension that pulls manga from Japscan.se",
	hentaiSource: false,
	websiteBaseURL: JS_DOMAIN,
	sourceTags: [
		{
			text: "Notifications",
			type: TagType.GREEN,
		}
	],
};

export class Japscan extends Source {
	getMangaShareUrl(mangaId: string): string | null {
		return `${JS_DOMAIN}/manga/${mangaId}/`;
	}

	async getMangaDetails(mangaId: string): Promise<Manga> {
		const request = createRequestObject({
			url: `${JS_DOMAIN}/manga/${mangaId}/`,
			method: "GET",
			// headers: this.constructHeaders({}, `/manga/${mangaId}/`),
		});
		const response = await this.requestManager.schedule(request, 1);
		this.cloudflareError(response.status);
		let $ = this.cheerio.load(response.data);

		return parseMangaDetails($, mangaId);
	}

	async getChapters(mangaId: string): Promise<Chapter[]> {
		const request = createRequestObject({
			url: `${JS_DOMAIN}/manga/${mangaId}/`,
			method: "GET",
			// headers: this.constructHeaders({}, `/manga/${mangaId}`),
		});
		const response = await this.requestManager.schedule(request, 1);
		this.cloudflareError(response.status);
		const $ = this.cheerio.load(response.data);

		return parseChapters($, mangaId);
	}

	async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
		const request = createRequestObject({
			url: `${JS_DOMAIN}/lecture-en-ligne/${mangaId}/${chapterId}/`,
			method: "GET",
			// headers: this.constructHeaders({ "content-type": "application/x-www-form-urlencoded" }, `lecture-en-ligne/${mangaId}/${chapterId}`),
			cookies: [{ name: "content_lazyload", value: "off", domain: `${JS_DOMAIN}` }],
		});
		const response = await this.requestManager.schedule(request, 1);
		this.cloudflareError(response.status);
		const $ = this.cheerio.load(response.data);

		return parseChapterDetails($, mangaId, chapterId);
	}

	// async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
	// 	const section1 = createHomeSection({ id: "recently_updated", title: "RECENTLY UPDATED TITLES" });
	// 	const section2 = createHomeSection({ id: "top_day", title: "POPULAR MANGA TODAY" });
    //     const section3 = createHomeSection({ id: "top_week", title: "POPULAR MANGA THIS WEEK" });
    //     const section4 = createHomeSection({ id: "top_week", title: "POPULAR MANGA THIS YEAR" });
	// 	const sections = [section1, section2, section3, section4];

    //     const request = createRequestObject({
	// 		url: `${JS_DOMAIN}`,
	// 		method: "GET",
	// 	});
    //     const response = await this.requestManager.schedule(request, 1);
    //     this.cloudflareError(response.status);
	// 	const $ = this.cheerio.load(response.data);
	// 	parseHomeSections($, sections, sectionCallback);
	// }

	// async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
	// 	const page: number = metadata?.page ?? 1;
	// 	let param: string = "";
	// 	switch (homepageSectionId) {
	// 		case "1_recently_updated":
	// 			param = `/search/?wpsolr_sort=sort_by_date_desc&wpsolr_page=${page}`;
	// 			break;
	// 		case "2_yaoi":
	// 			param = `/yaoi-manga/page/${page}/`;
	// 			break;
	// 		case "3_manhwa":
	// 			param = `/manhwa/page/${page}/`;
	// 			break;
	// 		case "4_manhua":
	// 			param = `/manhua/page/${page}/`;
	// 			break;
	// 		case "5_bara":
	// 			param = `/genre/bara/page/${page}/`;
	// 			break;
	// 		case "6_randomly_selected":
	// 			param = `/search/?wpsolr_sort=sort_by_random&wpsolr_page=${page}`;
	// 			break;
	// 		default:
	// 			return Promise.resolve(null);
	// 	}
	// 	const request = createRequestObject({
	// 		url: `${JS_DOMAIN}`,
	// 		method: "GET",
	// 		headers: this.constructHeaders({}),
	// 		param,
	// 	});
	// 	const response = await this.requestManager.schedule(request, 1);
	// 	const $ = this.cheerio.load(response.data);
	// 	const mangaTiles = parseHomeSections($, homepageSectionId);
	// 	if (homepageSectionId === "1_recently_updated" || homepageSectionId === "6_randomly_selected") {
	// 		// Different page structure since it's a search result
	// 		metadata = isLastPage($, true) ? undefined : { page: page + 1 };
	// 	} else {
	// 		metadata = isLastPage($, false) ? undefined : { page: page + 1 };
	// 	}

	// 	return createPagedResults({
	// 		results: mangaTiles,
	// 		metadata,
	// 	});
	// }

	async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
		let page: number = metadata?.page ?? 1;
		const request = createRequestObject({
			url: `${JS_DOMAIN}/search/?search=${encodeURIComponent(query.title ?? "")}${"&wpsolr_page=" + page}`,
			method: "GET",
			headers: this.constructHeaders({}, `/search/?search=${encodeURIComponent(query.title ?? "")}${"&wpsolr_page=" + page}`),
		});
		const response = await this.requestManager.schedule(request, 1);
		const $ = this.cheerio.load(response.data);
		const results = parseSearchResults($);
		metadata = isLastPage($, true) ? undefined : { page: page + 1 };

		return createPagedResults({
			results,
			metadata,
		});
	}

	async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
		let page = 1;
		let updatedManga: UpdatedManga = {
			ids: [],
			loadMore: true,
		};
		while (updatedManga.loadMore) {
			const request = createRequestObject({
				url: `${JS_DOMAIN}/search/?wpsolr_sort=sort_by_date_desc&wpsolr_page=${page++}`,
				method: "GET",
				headers: this.constructHeaders({}, `/search/?wpsolr_sort=sort_by_date_desc&wpsolr_page=${page++}`),
			});

			const response = await this.requestManager.schedule(request, 1);
			const $ = this.cheerio.load(response.data);

			updatedManga = parseUpdatedManga($, time, ids);
			if (updatedManga.ids.length > 0) {
				mangaUpdatesFoundCallback({
					ids: updatedManga.ids,
				});
			}
		}
    }
    
	cloudflareError(status: any) {
		if (status == 503) {
			throw new Error("CLOUDFLARE BYPASS ERROR: Please go to Settings > Sources > MyReadingManga and press Cloudflare Bypass");
		}
	}

	getCloudflareBypassRequest() {
		return createRequestObject({
			url: `${JS_DOMAIN}`,
			method: "GET",
			headers: this.constructHeaders({}),
		});
	}

	constructHeaders(headers: any, refererPath?: string): any {
		headers["Referer"] = `${JS_DOMAIN}${refererPath ?? ""}`;
		headers["Host"] = "myreadingmanga.info";
		headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8";

		return headers;
	}
}
