// دالة للبحث عن الأفلام أو البرامج بناءً على الكلمة الرئيسية
async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=68e094699525b18a70bab2f86b1fa706&query=${encodedKeyword}`);
        const data = await response.json();

        const results = data.results.map(result => {
            let title = result.title || result.name || result.original_title || result.original_name || "Untitled";
            let image = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : "";
            let href = result.media_type === "movie" ? `https://bingeflix.tv/movie/${result.id}` : `https://bingeflix.tv/tv/${result.id}`;
            
            return { title, image, href };
        });

        return JSON.stringify(results);
    } catch (error) {
        console.error('Error fetching search results:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

// دالة لاستخراج تفاصيل الفيلم أو المسلسل
async function extractDetails(url) {
    try {
        let mediaType = url.includes('/movie/') ? 'movie' : 'tv';
        const id = url.split('/').pop();

        let apiUrl = mediaType === 'movie' 
            ? `https://api.themoviedb.org/3/movie/${id}?api_key=ad301b7cc82ffe19273e55e4d4206885`
            : `https://api.themoviedb.org/3/tv/${id}?api_key=ad301b7cc82ffe19273e55e4d4206885`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        return JSON.stringify([{
            description: data.overview || 'No description available',
            aliases: `Duration: ${data.runtime || 'Unknown'} minutes`,
            airdate: `Released: ${data.release_date || 'Unknown'}`
        }]);
    } catch (error) {
        console.error('Error fetching details:', error);
        return JSON.stringify([{ description: 'Error loading description', aliases: 'Duration: Unknown', airdate: 'Aired/Released: Unknown' }]);
    }
}

// دالة لاستخراج قائمة الحلقات (للمسلسلات)
async function extractEpisodes(url) {
    try {
        let mediaType = url.includes('/movie/') ? 'movie' : 'tv';
        const id = url.split('/').pop();
        
        if (mediaType === 'movie') {
            return JSON.stringify([{ href: `https://bingeflix.tv/movie/${id}`, number: 1, title: "Full Movie" }]);
        }

        let apiUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=ad301b7cc82ffe19273e55e4d4206885`;
        const response = await fetch(apiUrl);
        const showData = await response.json();

        let allEpisodes = [];
        for (const season of showData.seasons) {
            if (season.season_number > 0) {
                const seasonResponse = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season.season_number}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
                const seasonData = await seasonResponse.json();
                const episodes = seasonData.episodes.map(episode => ({
                    href: `https://bingeflix.tv/tv/${id}?season=${season.season_number}&episode=${episode.episode_number}`,
                    number: episode.episode_number,
                    title: episode.name || "Untitled"
                }));
                allEpisodes = allEpisodes.concat(episodes);
            }
        }

        return JSON.stringify(allEpisodes);
    } catch (error) {
        console.error('Error fetching episodes:', error);
        return JSON.stringify([]);
    }
}

// دالة لاستخراج رابط البث
async function extractStreamUrl(url) {
    try {
        let mediaType = url.includes('/movie/') ? 'movie' : 'tv';
        const id = url.split('/').pop();

        if (mediaType === 'movie') {
            const embedUrl = `https://vidsrc.su/embed/movie/${id}`;
            const data1 = await fetch(embedUrl).then(res => res.text());

            const urlRegex = /url:\s*(['"])(.*?)\1/gm;
            const streams = Array.from(data1.matchAll(urlRegex), m => m[2].trim()).filter(Boolean);

            return JSON.stringify({ streams });
        } else {
            const [showId, seasonNumber, episodeNumber] = url.match(/tv\/([^\/]+)\/season\/([^\/]+)\/episode\/([^\/]+)/).slice(1);
            const embedUrl = `https://vidsrc.su/embed/tv/${showId}/${seasonNumber}/${episodeNumber}`;
            const data1 = await fetch(embedUrl).then(res => res.text());

            const urlRegex = /url:\s*(['"])(.*?)\1/gm;
            const streams = Array.from(data1.matchAll(urlRegex), m => m[2].trim()).filter(Boolean);

            return JSON.stringify({ streams });
        }
    } catch (error) {
        console.error('Error fetching stream URL:', error);
        return JSON.stringify({ streams: [] });
    }
}
// دالة لتحميل الترجمة (في حال كانت متاحة)
async function extractSubtitles(movieId) {
    try {
        // الحصول على روابط الترجمة باستخدام واجهة API
        const subtitleTrackResponse = await fetch(`https://sub.wyzie.ru/search?id=${movieId}`);
        const subtitleTrackData = await subtitleTrackResponse.json();

        let subtitleTrack = subtitleTrackData.find(track =>
            track.display.includes('Arabic') && (track.encoding === 'ASCII' || track.encoding === 'UTF-8')
        );

        if (!subtitleTrack) {
            subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP1252'));
        }

        if (!subtitleTrack) {
            subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP1250'));
        }

        if (!subtitleTrack) {
            subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP850'));
        }

        return subtitleTrack ? subtitleTrack.url : '';  // إرجاع رابط الترجمة إذا كان متاحًا
    } catch (err) {
        console.error('Error fetching subtitles:', err);
        return '';  // إذا فشل، إرجاع قيمة فارغة
    }
}

// دالة لتحميل روابط البث للمحتوى (فيلم أو مسلسل)
async function extractStreamLinks(movieId, isMovie = true) {
    try {
        let streams = [];

        const embedUrl = isMovie ? `https://vidsrc.su/embed/movie/${movieId}` : `https://vidsrc.su/embed/tv/${movieId}`;
        const data1 = await fetch(embedUrl).then(res => res.text());

        const urlRegex = /url:\s*(['"])(.*?)\1/gm;
        const streams2 = Array.from(data1.matchAll(urlRegex), m => m[2].trim()).filter(Boolean);

        streams = [...streams, ...streams2];

        return streams;  // إرجاع روابط البث المتاحة
    } catch (err) {
        console.error('Error fetching stream links:', err);
        return [];  // إرجاع مصفوفة فارغة إذا حدث خطأ
    }
}

// دالة لتحويل البيانات إلى Base64
function encodeToBase64(str) {
    try {
        return btoa(str);  // استخدام دالة البايتو
    } catch (err) {
        console.error('Error encoding to Base64:', err);
        return '';
    }
}

// دالة لفك ترميز الرابط إلى شكل أكثر قابلية للاستخدام
function decodeFromBase64(encodedStr) {
    try {
        return atob(encodedStr);  // فك الترميز باستخدام atob
    } catch (err) {
        console.error('Error decoding from Base64:', err);
        return '';
    }
}

// دالة لعرض روابط البث والترجمة بشكل منسق
async function displayStreamData(url) {
    try {
        const movieId = url.split('/').pop();  // استخراج ID من الرابط
        const streams = await extractStreamLinks(movieId, url.includes('/movie/'));
        const subtitleUrl = await extractSubtitles(movieId);

        return JSON.stringify({
            streams,
            subtitles: subtitleUrl
        });
    } catch (err) {
        console.error('Error displaying stream data:', err);
        return JSON.stringify({
            streams: [],
            subtitles: ''
        });
    }
}

// استخدام كل هذه الدوال
async function main() {
    const searchTerm = "Batman";  // يمكنك تغيير الكلمة المفتاحية كما تشاء
    const searchResultsData = await searchResults(searchTerm);
    console.log('Search Results:', searchResultsData);

    const movieUrl = 'https://bingeflix.tv/movie/12345';  // استبدل بـ URL حقيقي
    const movieDetails = await extractDetails(movieUrl);
    console.log('Movie Details:', movieDetails);

    const episodes = await extractEpisodes(movieUrl);
    console.log('Episodes:', episodes);

    const streamData = await displayStreamData(movieUrl);
    console.log('Stream Data:', streamData);
}

// بدء التطبيق
main();
