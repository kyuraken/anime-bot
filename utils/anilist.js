async function anilistFetch(query, variables = {}) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  let season;
  if (month <= 3) season = "WINTER";
  else if (month <= 6) season = "SPRING";
  else if (month <= 9) season = "SUMMER";
  else season = "FALL";
  return { season, year };
}

async function fetchSeasonalAnime(page = 1) {
  const { season, year } = getCurrentSeason();
  const json = await anilistFetch(`
    query {
      Page(page: ${page}, perPage: 25) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(season: ${season}, seasonYear: ${year}, type: ANIME, sort: POPULARITY_DESC) {
          id title { romaji english } coverImage { large medium }
          episodes averageScore genres status description(asHtml: false)
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  `);
  return { media: json.data.Page.media, pageInfo: json.data.Page.pageInfo };
}

async function fetchSeasonalByGenre(genre) {
  const { season, year } = getCurrentSeason();
  const json = await anilistFetch(`
    query ($genre: String) {
      Page(page: 1, perPage: 25) {
        media(season: ${season}, seasonYear: ${year}, type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
          id title { romaji english } coverImage { large medium }
          episodes averageScore genres status
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  `, { genre });
  return json.data.Page.media;
}

async function searchAnime(searchTerm) {
  const json = await anilistFetch(`
    query ($search: String) {
      Page(page: 1, perPage: 25) {
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id title { romaji english } coverImage { large medium }
          episodes averageScore genres status description(asHtml: false)
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
          season seasonYear
        }
      }
    }
  `, { search: searchTerm });
  return json.data.Page.media;
}

async function fetchAnimeById(id) {
  const json = await anilistFetch(`
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { english romaji } coverImage { medium }
        nextAiringEpisode { episode timeUntilAiring } status
      }
    }
  `, { id });
  return json.data.Media;
}

async function fetchRecommendations(animeId) {
  const json = await anilistFetch(`
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        recommendations(page: 1, perPage: 10, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id title { romaji english } coverImage { medium }
              averageScore genres episodes status
            }
          }
        }
      }
    }
  `, { id: animeId });
  return json.data.Media.recommendations.nodes.map((n) => n.mediaRecommendation).filter(Boolean);
}

async function fetchAniListWatching(anilistUsername) {
  const json = await anilistFetch(`
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME, status: CURRENT) {
        lists {
          entries {
            media {
              id title { english romaji } coverImage { medium }
              episodes averageScore nextAiringEpisode { episode timeUntilAiring }
            }
          }
        }
      }
    }
  `, { userName: anilistUsername });
  if (json.errors) throw new Error(json.errors[0].message);
  return (json.data.MediaListCollection?.lists || []).flatMap((l) => l.entries.map((e) => e.media));
}

module.exports = {
  getCurrentSeason,
  fetchSeasonalAnime,
  fetchSeasonalByGenre,
  searchAnime,
  fetchAnimeById,
  fetchRecommendations,
  fetchAniListWatching,
};
