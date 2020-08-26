import { h, Component } from 'preact';

import { bind, linkRef, Fileish } from '../../lib/initial-util';
import * as style from './style.scss';
import { FileDropEvent } from 'file-drop-element';
import 'file-drop-element';
import SnackBarElement, { SnackOptions } from '../../lib/SnackBar';
import '../../lib/SnackBar';
import Intro from '../intro';
import '../custom-els/LoadingSpinner';
// import { RemoveIcon } from '../../lib/icons';

const ROUTE_EDITOR = '/editor';

const compressPromise = import(
  /* webpackChunkName: "main-app" */
  '../compress');

const swBridgePromise = import(
  /* webpackChunkName: "sw-bridge" */
  '../../lib/sw-bridge');

function back() {
  window.history.back();
}

interface Props {}

interface State {
  awaitingShareTarget: boolean;
  file?: File | Fileish;
  drops: File[];
  isEditorOpen: Boolean;
  Compress?: typeof import('../compress').default;
  fetchingIndex:number;
  selected:number;
}

export default class App extends Component<Props, State> {
  state: State = {
    awaitingShareTarget: new URL(location.href).searchParams.has('share-target'),
    isEditorOpen: false,
    file: undefined,
    drops:[],
    Compress: undefined,
    fetchingIndex:-1,
    selected: -1,
  };

  snackbar?: SnackBarElement;
  private fileInput?: HTMLInputElement;
  private isSaved: boolean = false;

  constructor() {
    super();

    compressPromise.then((module) => {
      this.setState({ Compress: module.default });
    }).catch(() => {
      this.showSnack('Failed to load app');
    });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      const file = await getSharedImage();
      // Remove the ?share-target from the URL
      history.replaceState('', '', '/');
      this.openEditor();
      this.setState({ file, awaitingShareTarget: false });
    });

    // In development, persist application state across hot reloads:
    if (process.env.NODE_ENV === 'development') {
      this.setState(window.STATE);
      const oldCDU = this.componentDidUpdate;
      this.componentDidUpdate = (props, state, prev) => {
        if (oldCDU) oldCDU.call(this, props, state, prev);
        window.STATE = this.state;
      };
    }

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Squoosh, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event) => {
      event.preventDefault();
    });

    window.addEventListener('popstate', this.onPopState);
  }

  @bind
  private onFileDrop({ files }: FileDropEvent) {
    this.updateFileList(files);
  }

  @bind
  private onIntroPickFile(file: File | Fileish) {
    this.openEditor();
    this.setState({ file });
  }

  @bind
  private showSnack(message: string, options: SnackOptions = {}): Promise<string> {
    if (!this.snackbar) throw Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  }

  @bind
  private onPopState() {
    this.setState({ isEditorOpen: location.pathname === ROUTE_EDITOR });
  }

  @bind
  private removeFile(idx:number) {
    const { drops } = this.state;
    drops.splice(idx, 1);
    this.setState({ drops });
  }

  @bind
  private onDemoClick(idx:number) {
    const { drops } = this.state;
    const file = drops[idx];
    this.setState({ file, selected:idx });
  }

  @bind
  private openEditor() {
    if (this.state.isEditorOpen) return;
    // Change path, but preserve query string.
    const editorURL = new URL(location.href);
    editorURL.pathname = ROUTE_EDITOR;
    history.pushState(null, '', editorURL.href);
    this.setState({ isEditorOpen: true });
  }

  @bind
  onNext(): boolean {
    const { fetchingIndex, drops } = this.state;
    if (fetchingIndex >= drops.length - 1) {
      this.showSnack('finish', { timeout:3000, actions:['OK'] });
      this.setState({ fetchingIndex:drops.length });
      this.isSaved = true;
      return true;
    }
    let idx = fetchingIndex;
    // start
    if (fetchingIndex === -1) {
      idx = 0;
    }
    const file = drops[idx + 1];
    this.setState({ file, fetchingIndex:idx + 1 });
    return false;
  }

  @bind
  private onAddFileClick() {
    this.fileInput!.click();
  }

  @bind
  private onFileChange(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    this.updateFileList(arr);
  }

  private updateFileList(files:File[]): void{
    if (!files || files.length === 0) return;
    const { file, drops } = this.state;
    const f = file ? file :files[0];
    const fs = this.isSaved ? files : drops.concat(files);
    this.isSaved = false;
    this.openEditor();
    this.setState({ file:f, drops:fs, fetchingIndex:-1 });
  }

  render({}: Props, { file, isEditorOpen, Compress, awaitingShareTarget, drops, fetchingIndex, selected }: State) {
    const showSpinner = awaitingShareTarget || (isEditorOpen && !Compress);
    return (
      <div id="app" class={style.app}>
        <file-drop accept="image/*" onfiledrop={this.onFileDrop} class={style.drop} multiple>
          {
            showSpinner
              ? <loading-spinner class={style.appLoader}/>
              : isEditorOpen
                ? Compress && <Compress files={drops} file={file!} showSnack={this.showSnack} onBack={back} onNext={this.onNext} />
                :<Intro onFile={this.onIntroPickFile} showSnack={this.showSnack}/>
          }
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
        <div class={style.files}>
          <div key={-1} class={style.demoItem}>
            <button class={style.addButton} onClick={this.onAddFileClick} >+</button>
          </div>
          <input
            class={style.hide}
            ref={linkRef(this, 'fileInput')}
            type="file"
            multiple
            onChange={this.onFileChange}
          />
          <ul class={style.demos}>
            {drops.map((f, i) =>
               <li key={i} class={`${style.demoItem} ${selected === i ? style.demoItemActive : ''}`}>
                 <button class={style.demoButton} onClick={this.onDemoClick.bind(this, i)}>
                   <div class={style.demo}>
                     <div class={style.demoImgContainer}>
                       <div class={style.demoImgAspect}>
                         <img class={style.demoIcon} src={URL.createObjectURL(f)} alt="" decoding="async"/>
                         {fetchingIndex === i && <div class={style.demoLoading} ><loading-spinner className={style.demoLoadingSpinner}/></div>}
                       </div>
                     </div>
                     <div class={style.demoDesc}>
                       <div class={style.demoDescription}>{f.name}</div>
                       <div class={style.demoDescription}>{`(${f.size / 1000}k)`}</div>
                     </div>
                   </div>
                 </button>
                 <div class={style.removeArea}>
                   <button class={style.removeButton} onClick={this.removeFile.bind(this, i)}>―</button>
                 </div>
               </li>,
            )}
          </ul>
        </div>
      </div>
    );
  }
}
