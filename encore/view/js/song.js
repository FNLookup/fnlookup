// https://stackoverflow.com/questions/55409195/reading-ini-file-using-javascript
function parseINIString(data) {
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    var value = {};
    var lines = data.split(/[\r\n]+/);
    var section = null;
    lines.forEach(function (line) {
        if (regex.comment.test(line)) {
            return;
        } else if (regex.param.test(line)) {
            var match = line.match(regex.param);
            if (section) {
                value[section][match[1]] = match[2];
            } else {
                value[match[1]] = match[2];
            }
        } else if (regex.section.test(line)) {
            var match = line.match(regex.section);
            value[match[1]] = {};
            section = match[1];
        } else if (line.length == 0 && section) {
            section = null;
        };
    });
    return value;
}

function loadSong() {
    let params = new URLSearchParams(window.location.search);
    let firstKey = params.keys().next().value;

    function toTimeStr(secs) {
        return `${Math.floor(secs / 60)}:${(secs % 60) > 9 ? '' : '0'}${secs % 60}`
    }

    async function extractFilesFromZip(data) {
        let loading = document.createElement('p')
        loading.innerText = getTranslationKey('encore-chart:downloading').replace('[x0]', data.song.zip)
        document.getElementById('song').append(loading)

        let zipUrl = data.song.zip;
        let response = await fetch(data.raw + zipUrl);
        let size = response.headers.get('Content-Length');
        let zipData = await response.arrayBuffer();

        let jszip = new JSZip();
        let zip = await jszip.loadAsync(zipData);
        let root = data.song.isRootFirstDir ? '' : data.song.root + '/'

        //console.log(zip)

        let infoFile = zip.file(root + 'info.json')
        let iniFile = zip.file(root + 'song.ini')
        let isIni = iniFile != null && infoFile == null
        let info
        if (!isIni) {
            let infoContent = await infoFile.async('text');
            info = JSON.parse(infoContent)
        } else {
            let infoContent = parseINIString(await iniFile.async('text'))
            console.log(infoContent)
            let artFile = 'album.jpg'
            if (zip.file(root + 'album.png') != null) artFile = 'album.png';
            info = {
                art: artFile,
                title: infoContent.song.name,
                genres: [infoContent.song.genre],
                midi: 'notes.mid',
                release_year: infoContent.song.year
            }
        }
        //console.log(info)

        // Extract the .ogg file
        //let audioFile = zip.file('my-audio.ogg');

        let imageFile = zip.file(root + info.art);
        //console.log(imageFile)

        let imageBlob = await imageFile.async('blob');
        let imageUrl = URL.createObjectURL(imageBlob);

        let encoreTrack = document.createElement('a')
        encoreTrack.classList.add('encore-track-view', 'flex-media')

        let imgElement = document.createElement('img');
        imgElement.src = imageUrl;
        imgElement.classList.add('art', 'd-50-media')

        encoreTrack.append(imgElement)

        let trackDetails = document.createElement('track-details')
        let songTitle = document.createElement('h1')
        songTitle.innerText = data.song.title

        let songArtist = document.createElement('h2')
        songArtist.innerText = data.song.artist

        let songAlbum = document.createElement('h3')
        songAlbum.innerText = `${data.song.album != undefined ? data.song.album + ' - ' : ''}${toTimeStr(data.song.secs)}`

        let songCharter = document.createElement('h3')
        songCharter.innerText = `${getTranslationKey('encore-chart:charters')}: ${data.song.charters.length > 0 ? data.song.charters.join(', ') : getTranslationKey('encore-chart:charters-unknown')}`

        document.title = info.title + ' (Encore) - FNLookup'

        let songGenre = document.createElement('h3')
        let genrestr = getTranslationKey('encore-chart:genres') + ': ' + getTranslationKey('encore-chart:genres-unknown')
        if (info.genres != undefined) {
            genrestr = getTranslationKey('encore-chart:genres') + ': ' + info.genres.join(', ')
        }

        songGenre.innerText = genrestr

        let songYear = document.createElement('h3')
        songYear.innerText = getTranslationKey('encore-chart:release-year') + ': ' + info.release_year

        let songDiffs = document.createElement('a')
        songDiffs.classList.add('song-diffs');
        for (let diff of Object.keys(data.song.diffs)) {
            let diffContainer = document.createElement('div')
            diffContainer.classList.add('diff')

            icon = ''

            if (diff == 'ds' || diff == 'drums') icon = 'drums.webp'
            if (diff == 'ba' || diff == 'bass') icon = 'bass.webp'
            if (diff == 'vl' || diff == 'vocals') icon = 'voices.webp'
            if (diff == 'gr' || diff == 'guitar') icon = 'guitar.webp'
            if (diff == 'plastic_drums') icon = 'encore/pdrums.webp'
            if (diff == 'plastic_bass') icon = 'encore/pbass.webp'
            if (diff == 'plastic_guitar') icon = 'encore/ptar.webp'
            if (diff == 'plastic_vocals' || diff == 'pitched_vocals') icon = 'encore/pvox.webp'

            let imageIcon = document.createElement('img')
            imageIcon.classList.add('instrument-icon-encore')
            imageIcon.src = '/assets/icons/' + icon

            diffContainer.append(imageIcon)

            let diffBarsContainer = document.createElement('div')
            diffBarsContainer.classList.add('diffbars')

            let difficultyOfChart = data.song.diffs[diff] + 1;

            for (let i = 0; i < difficultyOfChart; i++) {
                let diffThing = document.createElement('div')
                diffThing.classList.add('diffbar')
                diffBarsContainer.append(diffThing);
            }

            for (let i = 0; i < 7 - difficultyOfChart; i++) {
                let diffThing = document.createElement('div')
                diffThing.classList.add('diffbar', 'empty')
                diffBarsContainer.append(diffThing);
            }

            diffContainer.append(diffBarsContainer)

            songDiffs.append(diffContainer)
        }

        trackDetails.append(songTitle, songArtist, songAlbum, songCharter, songGenre, songYear, document.createElement('hr'), songDiffs)
        encoreTrack.append(trackDetails)

        document.getElementById('song').appendChild(encoreTrack);

        let midiFileData = await zip.file(root + info.midi).async('uint8array');
        let midi = new Midi(midiFileData);

        console.log(midi.tracks)

        function trackAnalysis(trackName, minPitch, maxPitch) {
            let track = midi.tracks.find(track => {
                return track.name == trackName
            })
            console.log(track)
            if (track == null) return 0
            let noteCount = 0;
            for (let note of track.notes) {
                if (note.midi >= minPitch && note.midi <= maxPitch) {
                    noteCount++;
                }
            }

            return noteCount
        }

        let tracks = {
            'instruments:drums': (isIni ? 'PAD DRUMS' : 'PART DRUMS'),
            'instruments:bass': (isIni ? 'PAD BASS' : 'PART BASS'),
            'instruments:guitar': (isIni ? 'PAD GUITAR' : 'PART GUITAR'),
            'instruments:vocals': (isIni ? 'PAD VOCALS' : 'PART VOCALS'),
            'instruments:prodrums': (isIni ? 'PART DRUMS' : 'PLASTIC DRUMS'),
            'instruments:probass': (isIni ? 'PART BASS' : 'PLASTIC BASS'),
            'instruments:proguitar': (isIni ? 'PART GUITAR' : 'PLASTIC GUITAR')
        }

        let difficulties = {
            'E': [60, 64],
            'M': [72, 75],
            'H': [84, 87],
            'X': [96, 100]
        }

        let trackAnalysisTable = document.createElement('track-midi-notes')
        tablefullhtml = `            <table>
                <tr>
                    <th>${getTranslationKey('encore-chart:instrument')}</th>
                    <th>E</th>
                    <th>M</th>
                    <th>H</th>
                    <th>X</th>
                </tr>`

        for (let track of Object.keys(tracks)) {
            // let trackAnalysisName = document.createElement('track-name')
            // trackAnalysisName.innerText = track

            let tablehtml = `<tr>
                    <td>${getTranslationKey(track)}</td>`

            let trackNotes = document.createElement('div')

            // trackAnalysisName.append(trackNotes)

            totalNotesForTrack = 0

            for (let diff of Object.keys(difficulties)) {
                let trackNotesTotal = trackAnalysis(tracks[track], difficulties[diff][0], difficulties[diff][1])
                totalNotesForTrack += trackNotesTotal
                //if (trackNotesTotal < 1) continue
                let item = Object.keys(difficulties).indexOf(diff)

                tablehtml += `<td>${trackNotesTotal > 0 ? trackNotesTotal : ''}</td>`

                //diffAnalysis.innerText += `${diff}: ${trackNotesTotal} ${shouldAddDash ? '- ' : ''}` 
            }

            tablefullhtml += tablehtml + '</tr>';

            // trackAnalysisTable.append(trackAnalysisName)
        }

        tablefullhtml += '</table>';
        trackAnalysisTable.innerHTML = tablefullhtml

        let downloadButton = document.createElement('a')
        downloadButton.classList.add('fortnite-button', 'fortnite-button-border', 'no-link', 'encore-download')
        downloadButton.innerText = getTranslationKey('encore-chart:download-chart') + (isIni ? ' (INI)' : '')

        let mbsize = size / 1024 / 1024
        let mbs = mbsize.toFixed(2)

        downloadButton.title = getTranslationKey('encore-chart:size').replace('[x0]', mbs + ' MB')

        downloadButton.href = data.raw + zipUrl

        trackDetails.append(document.createElement('hr'), trackAnalysisTable)

        trackDetails.append(downloadButton)

        loading.remove()
    }

    let data = getApiRequestData('https://fnlookup-apiv2.vercel.app/api?encore-songs=true&songid=' + firstKey);
    fetch(data.url, data.data).then(r => r.json()).then(r => {
        extractFilesFromZip(r);
    }).catch(err => {
        console.error(err)
    })
}