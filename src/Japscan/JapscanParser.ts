import { Chapter, ChapterDetails, LanguageCode, Manga, MangaStatus, MangaTile, TagSection, Tag, HomeSection } from "paperback-extensions-common";
import { JS_DOMAIN } from "../Japscan/Japscan";

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
	const context = $("#main > .card").first();

	// Title
	const title: string = decodeHTMLEntity($("h1", context).text()).replace(/Manhua | Manhwa |Manga |Bande Dessinée /g, "").trim() ?? "";
	let titles: string[] = [title];

	// Metadatas
	let status: MangaStatus = MangaStatus.ONGOING;
	const categoriesTags: Tag[] = [];
    const genresTags: Tag[] = [];
    let hentai: boolean = false;
    let artist: string = "";
	let author: string = "";
	for (const metadata of $(".mb-2", $(".d-flex > .m-2", context).next()).toArray()) {
		switch ($("p > span", metadata).text().trim()) {
			case "Nom Original:":
				titles.push(decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1].trim()) ?? "");
				break;
			case "Nom(s) Alternatif(s):":
				for (const name of $("a", metadata).toArray()) {
					titles.push(decodeHTMLEntity($(name).text()).trim() ?? "");
				}
				break;
			case "Statut:":
				switch (decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1]).trim() ?? "") {
					case "En Cours":
						status = MangaStatus.ONGOING;
						break;
					case "Terminé":
						status = MangaStatus.COMPLETED;
						break;
					default:
						status = MangaStatus.ONGOING;
						break;
				}
                break;
            case "Type(s):":
				const categories = decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1]).split(",") ?? "";
				for (const category of categories) {
					categoriesTags.push(
						createTag({
							id: category.trim().toLowerCase(),
							label: category.trim(),
						})
					);
				}
				break;
            case "Genre(s):":
				const genres = decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1]).split(",") ?? "";
                for (const genre of genres) {
                    if (genre.trim().toLowerCase().includes("smut")) {
						hentai = true;
					}
					genresTags.push(
						createTag({
							id: genre.trim().toLowerCase(),
							label: genre.trim(),
						})
					);
				}
				break;
			case "Artiste(s):":
				artist = decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1].trim()) ?? "";
				break;
            case "Auteur(s):":
                author = decodeHTMLEntity($(metadata).text().replace(/\s+/g, " ").split(":")[1].trim()) ?? "";
                break;
			default:
				break;
		}
	}

	// Tags
	const tagSections: TagSection[] = [
		createTagSection({
			id: "category",
			label: "Category",
			tags: categoriesTags,
		}),
		createTagSection({
			id: "genres",
			label: "Genres",
			tags: genresTags,
		}),
	];

    // Language
    const langFlag: LanguageCode = LanguageCode.FRENCH;
    const langName: string = "fr";
    
	// Thumbnail
	const image: string = encodeURI(`${JS_DOMAIN}/imgs/mangas/${mangaId}.jpg` ?? "");

	// Last update
	const lastUpdate: string = timeSince(new Date(Date.parse(decodeHTMLEntity($(".float-right", $("#collapse-1")).first().text()).trim() ?? 0)));

	// Description
	const description: string = decodeHTMLEntity($(".list-group-item-primary", context).text()).trim() ?? "";

	return createManga({
		id: mangaId,
		titles,
		image,
		status,
		artist,
		author,
		langFlag,
		langName,
		tags: tagSections,
		lastUpdate,
		desc: description,
		hentai,
		rating: 0, // Because rating is required in the Manga interface
	});
};

// ! Tachi is rendering and screenshotting to get the image, gl implementing that sh*t https://github.com/tachiyomiorg/tachiyomi-extensions/blob/master/src/fr/japscan/src/eu/kanade/tachiyomi/extension/fr/japscan/Japscan.kt#L366
export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const context = $("#chapters_list");

	let chapters: Chapter[] = [];
	const langCode: LanguageCode = LanguageCode.FRENCH;

    for (const element of $(".chapters_list", context).toArray()) {
        const fullName: string = decodeHTMLEntity($("a", element).text().replace(/\s+/g, " ").trim());
        const volume: number = Number($(element).parent().prev().text().replace(/\s+/g, " ").trim().match(/([0-9]\d+(\.?\d+)?)/g)?.pop());
        const chapNum = Number(fullName.match(/([0-9]\d+(\.?\d+)?)/g)?.pop());
        const id: string = chapNum.toString();
        const chapName = fullName.split(":")[1];
        const time = new Date(Date.parse(decodeHTMLEntity($(".float-right", element).text())));
		chapters.push(
			createChapter({
				mangaId,
				id,
				volume: Number.isNaN(volume) ? 0 : volume,
				chapNum: Number.isNaN(chapNum) ? 0 : chapNum,
				name: chapName ? chapName.trim() : "",
				langCode,
				time
			})
		);
	}
    
	return chapters;
};

export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
	const pages: string[] = [];
	const container: Cheerio = $("div.entry-content");
	for (const img of $("img", container).toArray()) {
		pages.push(encodeURI(getImageSrc($(img))));
    }
    
	return createChapterDetails({
		id: chapterId,
		mangaId: mangaId,
		pages,
		longStrip: false,
	});
};

// export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
// 	let mangaTiles: MangaTile[] = [];
// 	if (sectionId === "1_recently_updated" || sectionId == "6_randomly_selected") {
// 		// Different page structure since it's a search result
// 		mangaTiles = mangaTiles.concat(parseSearchResults($));
// 	} else {
// 		const container: Cheerio = $("main.content");
// 		for (const element of $(".post", container).toArray()) {
// 			const id: string = ($(".entry-title-link", element).attr("href") ?? "").split("/").reverse()[1] ?? "";
// 			const title: string =
// 				decodeHTMLEntity($(".entry-title-link", element).text())
// 					.replace(/(\[.+?\])/g, "")
// 					.replace(/(\(.+?\))/g, "")
// 					.trim() ?? "";
// 			const image: string = encodeURI(getImageSrc($(".post-image", element)));
// 			let author: string = "";
// 			const authorFound: string[] | null = decodeHTMLEntity($(".entry-title-link", element).text()).match(/(\[.+?\])/g);
// 			if (authorFound !== null && authorFound.length > 0) {
// 				author = authorFound[0]
// 					.toString()
// 					.replace(/(\[|\])/g, "")
// 					.trim();
// 			}
// 			mangaTiles.push(
// 				createMangaTile({
// 					id,
// 					image,
// 					title: createIconText({ text: title }),
// 					subtitleText: createIconText({ text: author }),
// 				})
// 			);
// 		}
// 	}

// 	return mangaTiles;
// };

export const parseSearchResults = ($: CheerioStatic): MangaTile[] => {
	const mangaTiles: MangaTile[] = [];
	const container: Cheerio = $("div.wdm_results");
	for (const element of $(".results-by-facets > div", container).toArray()) {
		const id: string = ($("a", element).attr("href") ?? "").split("/").reverse()[1] ?? "";
		const title: string = $(".p_title", element).text().replace(/(\[.+?\])/g, "").replace(/(\(.+?\))/g, "").trim() ?? "";
		const image: string = encodeURI(getImageSrc($(".wdm_result_list_thumb", element)));
		const category: string = $("span.pcat > span.pcat", element).text() ?? "";
		let author: string = "";
		const authorFound: string[] | null = decodeHTMLEntity($(".p_title", element).text()).match(/(\[.+?\])/g);
        if (authorFound !== null && authorFound.length > 0) {
            author = authorFound[0].toString().replace(/(\[|\])/g, "").trim();
		}
		if (!category.match(/in Video/)) {
			mangaTiles.push(
				createMangaTile({
					id,
					image,
					title: createIconText({ text: title }),
					subtitleText: createIconText({ text: author }),
				})
			);
		}
    }
    
	return mangaTiles;
};

export interface UpdatedManga {
	ids: string[];
	loadMore: boolean;
}

export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {
	const manga: string[] = [];
	let loadMore = true;
	const container: Cheerio = $("div.wdm_results");
	for (const element of $(".results-by-facets > div", container).toArray()) {
		const id: string = ($("a", element).attr("href") ?? "").split("/").reverse()[1] ?? "";
		const mangaTime: string[] =
			$(".pdate")
				.text()
				.match(/[0-9]{2}[-|\/]{1}[0-3]{1}[0-9]{1}[-|\/]{1}[0-9]{4}/g) ?? [];
		if (mangaTime.length > 0 && new Date(Date.parse(mangaTime[0])) > time) {
			ids.includes(id) ? manga.push(id) : (loadMore = false);
		}
	}

	return {
		ids: manga,
		loadMore,
	};
};

export const isLastPage = ($: CheerioSelector, isSearchPage: boolean): boolean => {
	if (isSearchPage) {
		const container: Cheerio = $("#pagination-flickr");
		const current = $(".active", container).text();
		const total = $(".paginate", container).last().text();
		if (current) {
			if (total === current) {
				return true;
			} else {
				return false;
			}
		} else {
			return true;
		}
	} else {
		if ($(".pagination-next").length > 0) {
			return false;
		} else {
			return true;
		}
	}
};


// Utility functions

const decodeHTMLEntity = (str: string): string => {
	return str.replace(/&#(\d+);/g, function (match, dec) {
		return String.fromCharCode(dec);
	});
};

const getImageSrc = (imageObj: Cheerio | undefined): string => {
	const hasDataSrc = typeof imageObj?.attr("data-src") != "undefined";
	const image = hasDataSrc ? imageObj?.attr("data-src") : imageObj?.attr("src");

	return image?.trim() ?? "";
};

const timeSince = function (date: Date) {
	const seconds: number = Math.floor((new Date().getTime() - date.getTime()) / 1000);
	let interval: number = Math.floor(seconds / 60 / 60 / 24 / 365);
	if (interval >= 1) {
		return Math.floor(interval) > 1 ? Math.floor(interval) + " years ago" : Math.floor(interval) + " year ago";
	}
	interval = seconds / 60 / 60 / 24 / 30;
	if (interval >= 1) {
		return Math.floor(interval) > 1 ? Math.floor(interval) + " months ago" : Math.floor(interval) + " month ago";
	}
	interval = seconds / 60 / 60 / 24;
	if (interval >= 1) {
		return Math.floor(interval) > 1 ? Math.floor(interval) + " days ago" : Math.floor(interval) + " day ago";
	}
	interval = seconds / 60 / 60;
	if (interval >= 1) {
		return Math.floor(interval) > 1 ? Math.floor(interval) + " hours ago" : Math.floor(interval) + " hour ago";
	}
	interval = seconds / 60;
	if (interval >= 1) {
		return Math.floor(interval) > 1 ? Math.floor(interval) + " minutes ago" : Math.floor(interval) + " minute ago";
	}
	return Math.floor(interval) > 1 ? Math.floor(interval) + " seconds ago" : Math.floor(interval) + " second ago";
};