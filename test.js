async function searchResults(keyword) {
    try {
        // ترميز الكلمة البحثية بشكل آمن
        const encodedKeyword = encodeURIComponent(keyword);
        
        // استدعاء API البحث باستخدام الكلمة المشفرة
        const responseText = await soraFetch(`https://api.themoviedb.org/3/search/multi?api_key=68e094699525b18a70bab2f86b1fa706&query=${encodedKeyword}`);
        const data = await responseText.json();
        
        // التأكد من وجود نتائج
        if (!data.results || data.results.length === 0) {
            return JSON.stringify([{ title: 'No results found', image: '', href: '' }]);
        }

        // تحويل البيانات لتناسب العرض في التطبيق
        const transformedResults = data.results.map(result => {
            if (result.media_type === "movie" || result.title) {
                return {
                    title: result.title || result.name || result.original_title || result.original_name,
                    image: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
                    href: `https://bingeflix.tv/movie/${result.id}`
                };
            } else if (result.media_type === "tv" || result.name) {
                return {
                    title: result.name || result.title || result.original_name || result.original_title,
                    image: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
                    href: `https://bingeflix.tv/tv/${result.id}`
                };
            } else {
                return {
                    title: result.title || result.name || result.original_name || result.original_title || "Untitled",
                    image: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
                    href: `https://bingeflix.tv/tv/${result.id}`
                };
            }
        });

        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Fetch error in searchResults:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

// تابع لجلب تفاصيل الفيلم أو العرض التلفزيوني
async function extractDetails(url) {
    try {
        if (url.includes('/movie/')) {
            const match = url.match(/https:\/\/bingeflix\.tv\/movie\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const movieId = match[1];
            const responseText = await soraFetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
            const data = await responseText.json();

            return JSON.stringify([{
                description: data.overview || 'No description available',
                aliases: `Duration: ${data.runtime ? data.runtime + " minutes" : 'Unknown'}`,
                airdate: `Released: ${data.release_date ? data.release_date : 'Unknown'}`
            }]);

        } else if (url.includes('/tv/')) {
            const match = url.match(/https:\/\/bingeflix\.tv\/tv\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const showId = match[1];
            const responseText = await soraFetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
            const data = await responseText.json();

            return JSON.stringify([{
                description: data.overview || 'No description available',
                aliases: `Duration: ${data.episode_run_time && data.episode_run_time.length ? data.episode_run_time.join(', ') + " minutes" : 'Unknown'}`,
                airdate: `Aired: ${data.first_air_date ? data.first_air_date : 'Unknown'}`
            }]);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{ description: 'Error loading description', aliases: 'Duration: Unknown', airdate: 'Aired/Released: Unknown' }]);
    }
}

// تابع لجلب روابط الحلقات في المسلسل
async function extractEpisodes(url) {
    try {
        if (url.includes('/movie/')) {
            const match = url.match(/https:\/\/bingeflix\.tv\/movie\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const movieId = match[1];
            return JSON.stringify([{
                href: `https://bingeflix.tv/movie/${movieId}`,
                number: 1,
                title: "Full Movie"
            }]);

        } else if (url.includes('/tv/')) {
            const match = url.match(/https:\/\/bingeflix\.tv\/tv\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const showId = match[1];
            const showResponseText = await soraFetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
            const showData = await showResponseText.json();

            let allEpisodes = [];
            for (const season of showData.seasons) {
                const seasonNumber = season.season_number;
                if (seasonNumber === 0) continue;

                const seasonResponseText = await soraFetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
                const seasonData = await seasonResponseText.json();

                if (seasonData.episodes && seasonData.episodes.length) {
                    const episodes = seasonData.episodes.map(episode => ({
                        href: `https://bingeflix.tv/tv/${showId}?season=${seasonNumber}&episode=${episode.episode_number}`,
                        number: episode.episode_number,
                        title: episode.name || ""
                    }));
                    allEpisodes = allEpisodes.concat(episodes);
                }
            }
            return JSON.stringify(allEpisodes);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Fetch error in extractEpisodes:', error);
        return JSON.stringify([]);
    }
}

// تابع لجلب روابط البث
async function extractStreamUrl(url) {
    try {
        if (url.includes('/movie/')) {
            const match = url.match(/https:\/\/bingeflix\.tv\/movie\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const movieId = match[1];
            let streams = [];
            const embedUrl = `https://vidsrc.su/embed/movie/${movieId}`;
            const data1 = await soraFetch(embedUrl).then(res => res.text());
            const urlRegex = /^(?!\s*\/\/).*url:\s*(['"])(.*?)\1/gm;
            const streams2 = Array.from(data1.matchAll(urlRegex), m => m[2].trim()).filter(Boolean);

            for (let i = 0; i < streams2.length; i++) {
                const currentStream = streams2[i];
                if (currentStream) {
                    streams.push(currentStream);
                }
            }

            let subtitle = '';
            const subtitleTrackResponse = await soraFetch(`https://sub.wyzie.ru/search?id=${movieId}`);
            const subtitleTrackData = await subtitleTrackResponse.json();

            let subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'ASCII' || track.encoding === 'UTF-8'));
            if (!subtitleTrack) {
                subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP1252'));
            }
            if (!subtitleTrack) {
                subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP1250'));
            }
            if (!subtitleTrack) {
                subtitleTrack = subtitleTrackData.find(track => track.display.includes('Arabic') && (track.encoding === 'CP850'));
            }

            subtitle = subtitleTrack ? subtitleTrack.url : '';

            const C = movieId.toString().split("").map((digit) => {
                const encoding = "abcdefghij";
                return encoding[parseInt(digit)];
            }).join("");

            const B = C.split("").reverse().join("");
            const A = btoa(B);
            const D = btoa(A);
            const urlovo = `https://api2.vidsrc.vip/movie/${D}`;

            const response = await soraFetch(urlovo);
            const data = await response.json();
            const sourceKeys = ["source4", "source1", "source2", "source5", "source3"];

            for (let key of sourceKeys) {
                const currentSource = data[key];
                if (currentSource && currentSource.url && currentSource.language === "Arabic") {
                    if (currentSource.url !== "https://vid3c.site/stream/file2/video.mp4") {
                        streams.push(currentSource.url);
                    }
                }
            }

            const result = { streams, subtitles: subtitle };
            return JSON.stringify(result);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Fetch error in extractStreamUrl:', error);
        return JSON.stringify({ streams: [], subtitles: "" });
    }
}

async function soraFetch(url) {
    try {
        const response = await fetch(url);
        return response.text();
    } catch (error) {
        console.log('Fetch error:', error);
        throw new Error('Fetch failed');
    }
}

function btoa(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input);
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("btoa failed: The string contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
    }
    return output;
}
