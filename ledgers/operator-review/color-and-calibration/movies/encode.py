import hashlib, json, pathlib, subprocess

root=pathlib.Path('work/r4-calibration-review')
data=json.loads((root/'manifest.json').read_text())
assert len(data['cases'])==4
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for case in data['cases']:
    folder=root/case['key']; versions=case['versions']
    assert len(versions)==2 and all(len(v['rows'])==96 for v in versions)
    for v in versions:
        label='Before '+v['revision'][:8] if v['version']=='before' else 'After '+v['revision'][:8]
        (folder/v['version']/'label.txt').write_text(label)
    def chain(v,label):
        text=folder/v/'label.txt'
        return f'[{label}:v]scale=390:808:force_original_aspect_ratio=decrease:out_color_matrix=bt709:out_range=tv,pad=390:808:(ow-iw)/2:(oh-ih)/2:black,pad=390:844:0:36:black,drawtext=fontfile={font}:textfile={text}:fontsize=15:fontcolor=white:x=(w-tw)/2:y=10[{v}]'
    filters=chain('before',0)+';'+chain('after',1)+';[before][after]hstack=inputs=2,format=yuv420p[out]'
    target=root/(case['key']+'-before-after.mp4')
    metadata=['-metadata','title='+case['title']+' — normalization review','-metadata','artist='+case['author']+'; adaptation by Ryan with Codex (GPT-6)','-metadata','copyright=CC BY 3.0 — '+case['source'],'-metadata','comment=Fixed source-clock comparison, not a live playback-speed measurement.']
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-framerate','16','-i',str(folder/'before/%05d.png'),'-framerate','16','-i',str(folder/'after/%05d.png'),'-filter_complex',filters,'-map','[out]','-frames:v','96','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','iec61966-2-1','-movflags','+faststart',*metadata,str(target)],check=True)
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,nb_read_frames:format=duration','-of','json',str(target)]))
    stream=info['streams'][0]
    assert (stream['width'],stream['height'],int(stream['nb_read_frames']))==(780,844,96)
    assert abs(float(info['format']['duration'])-6)<.01
    poster=root/(case['key']+'-before-after.jpg')
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(target),'-frames:v','1','-q:v','3',str(poster)],check=True)
    assert poster.stat().st_size<1_000_000
    case['output']={'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target),'frames':96,'fps':16,'seconds':6,'poster':poster.name,'posterBytes':poster.stat().st_size,'posterSha256':sha(poster)}
    print(case['id'],case['output'],flush=True)
(root/'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
