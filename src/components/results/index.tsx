import { h, Component, ComponentChildren, ComponentChild } from 'preact';

import * as style from './style.scss';
import FileSize from './FileSize';
import { DownloadIcon, CopyAcrossIcon, CopyAcrossIconProps } from '../../lib/icons';
import '../custom-els/LoadingSpinner';
import { SourceImage } from '../compress';
import { Fileish, bind } from '../../lib/initial-util';

interface Props {
  loading: boolean;
  source?: SourceImage;
  imageFile?: Fileish;
  downloadUrl?: string;
  children: ComponentChildren;
  copyDirection: CopyAcrossIconProps['copyDirection'];
  buttonPosition: keyof typeof buttonPositionClass;
  onCopyToOtherClick(): void;
  onNext:() => boolean;
}

interface State {
  showLoadingState: boolean;
}

const buttonPositionClass = {
  'stack-right': style.stackRight,
  'download-right': style.downloadRight,
  'download-left': style.downloadLeft,
};

const loadingReactionDelay = 500;

export default class Results extends Component<Props, State> {
  state: State = {
    showLoadingState: false,
  };

  /** The timeout ID between entering the loading state, and changing UI */
  private loadingTimeoutId: number = 0;
  private isStart: boolean = false;
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.loading && !this.props.loading) {
      // Just stopped loading
      clearTimeout(this.loadingTimeoutId);
      this.setState({ showLoadingState: false });
      if (this.props.downloadUrl && this.props.imageFile && this.props.downloadUrl != prevProps.downloadUrl) {
        if (this.isStart) {
          this.download();
        }
      }
    } else if (!prevProps.loading && this.props.loading) {
      // Just started loading
      this.loadingTimeoutId = self.setTimeout(
        () => this.setState({ showLoadingState: true }),
        loadingReactionDelay,
      );
    }
  }

  @bind
  private onCopyToOtherClick(event: Event) {
    event.preventDefault();
    this.props.onCopyToOtherClick();
  }

  @bind
  onDownload() {
    // GA can’t do floats. So we round to ints. We're deliberately rounding to nearest kilobyte to
    // avoid cases where exact image sizes leak something interesting about the user.
    const before = Math.round(this.props.source!.file.size / 1024);
    const after = Math.round(this.props.imageFile!.size / 1024);
    const change = Math.round(after / before * 1000);

    ga('send', 'event', 'compression', 'download', {
      metric1: before,
      metric2: after,
      metric3: change,
    });
  }

  @bind
  fakeDownload(obj:HTMLElement) {
    const ev = document.createEvent('MouseEvents');
    ev.initMouseEvent(
          'click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null,
      );
    obj.dispatchEvent(ev);
  }

  @bind
  download() {
    const { imageFile, onNext } = this.props;
    if (!imageFile) return;

    this.isStart = true;
    const saveLink = document.createElementNS('http://www.w3.org/1999/xhtml', 'a') as HTMLAnchorElement;
    saveLink.href = this.props.downloadUrl as string;
    saveLink.download = imageFile.name;
    this.onDownload();
    this.fakeDownload(saveLink);
    saveLink.remove();
    const isFinish = onNext();
    if (isFinish) {
      this.isStart = false;
      this.setState({ showLoadingState: false });
    }
  }

  render(
    { source, imageFile, downloadUrl, children, copyDirection, buttonPosition }: Props,
    { showLoadingState }: State,
  ) {

    return (
      <div class={`${style.results} ${buttonPositionClass[buttonPosition]}`}>
        <div class={style.resultData}>
          {(children as ComponentChild[])[0]
            ? <div class={style.resultTitle}>{children}</div>
            : null
          }
          {!imageFile || showLoadingState ? 'Working…' :
            <FileSize
              blob={imageFile}
              compareTo={(source && imageFile !== source.file) ? source.file : undefined}
            />
          }
        </div>

        <button
          class={style.copyToOther}
          title="Copy settings to other side"
          onClick={this.onCopyToOtherClick}
        >
          <CopyAcrossIcon class={style.copyIcon} copyDirection={copyDirection} />
        </button>

        <div class={style.download}>
          {(downloadUrl && imageFile) && (
            <a
              class={`${style.downloadLink} ${showLoadingState ? style.downloadLinkDisable : ''}`}
              // href={downloadUrl}
              // download={imageFile.name}
              // title="Download"
              onClick={this.download}
            >
              <DownloadIcon class={style.downloadIcon} />
            </a>
          )}
          {showLoadingState && <loading-spinner class={style.spinner} />}
        </div>
      </div>
    );
  }
}
