import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Log } from '../../_core/models/Log';
import mermaid from 'mermaid';
import Chart from 'chart.js/auto';
import { MatButton } from '@angular/material/button';
import { DateFormatPipe } from '../../_core/pipes/DateFormatPipe';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { PanZoomConfig, PanZoomAPI, PanZoomComponent } from 'ngx-panzoom';
import { Point } from 'ngx-panzoom/lib/types/point';
import { PopoverComponent } from '../../shared/popover/popover.component';
import { NgIf } from '@angular/common';
import { LogService } from '../../_core/services/log.service';
import { ExecutionTime } from '../../_core/models/ExecutionTime';
import { SequenceDiagramInteraction } from '../../_core/models/SequenceDiagramInteraction';

@Component({
  selector: 'app-log-details',
  standalone: true,
  templateUrl: './log-details.component.html',
  styleUrl: './log-details.component.scss',
  imports: [
    MatButton,
    DateFormatPipe,
    MatCardModule,
    MatDividerModule,
    PanZoomComponent,
    PopoverComponent,
    NgIf,
  ],
})
export class LogDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sequenceDiagramDiv') sequenceDiagramElement:
    | ElementRef
    | undefined;

  methodsExecutionTimeChart: any | null = null;

  logId: string = 'QsUF144BKAXOlq7ez4RR';
  log: Log | null = null;

  @ViewChild('panzoomElement') panzoomElement: ElementRef | undefined;
  private panZoomAPI: PanZoomAPI | undefined;
  panZoomConfig: PanZoomConfig = new PanZoomConfig({
    zoomLevels: 10,
    scalePerZoomLevel: 1.5,
    neutralZoomLevel: -2,
    zoomOnMouseWheel: false,
    zoomOnDoubleClick: false,
    friction: 100,
    dynamicContentDimensions: true,
  });

  sequenceDiagramTheme = `
  %%{
    init: {
      "theme": "base",
      "themeVariables": {
        "primaryColor": "#212c4d",
        "secondaryColor": "#212c4d",
        "noteBkgColor": "#212c4d",

        "primaryBorderColor": "#717582",
        "noteBorderColor": "#b9bcc7",
        "activationBorderColor": "#b9bcc7",

        "primaryTextColor": "#b9bcc7",
        "noteTextColor": "#b9bcc7"
      }
    }
  }%%`;

  showPopoverFlag: boolean = false;
  popoverX: number = 0;
  popoverY: number = 0;
  popoverContent: string = '';

  constructor(private logService: LogService) {}

  ngOnInit() {
    this.createMethodsExecutionTimeChart();

    this.logService.getLog(this.logId).subscribe({
      next: (res) => {
        this.log = res;
        this.initializeMethodsExecutionTimeChart().then(
          () => {},
          (error) => console.log(error)
        );
        this.initializeSequenceDiagram().then(
          () => {},
          (error) => console.log(error)
        );
      },
      error: (error) => {
        console.log(error);
      },
    });

    document.body.addEventListener('wheel', this.hidePopover.bind(this));
    document.body.addEventListener('click', this.handleOutsideClick.bind(this));

    this.panZoomConfig.api.subscribe(
      (api: PanZoomAPI) => (this.panZoomAPI = api)
    );
  }

  ngAfterViewInit(): void {
    const width = this.panzoomElement?.nativeElement.offsetWidth;
    const height = this.panzoomElement?.nativeElement.offsetHeight;

    const point: Point = { x: width / 9.5, y: height / 12 };

    this.panZoomAPI?.panToPoint(point);
    this.panzoomElement?.nativeElement.addEventListener(
      'wheel',
      this.zoomHandler.bind(this),
      { passive: false }
    );
  }

  ngOnDestroy() {
    document.body.removeEventListener(
      'click',
      this.handleOutsideClick.bind(this)
    );
    document.body.removeEventListener('wheel', this.hidePopover.bind(this));
  }

  getControllerName(fullName: string | undefined) {
    if (!fullName) return '';

    const className = fullName.split(',')[0].trim();

    if (className) return className.substring(className.lastIndexOf('.') + 1);
    else return '';
  }

  getTimeDifference(date1: Date | undefined, date2: Date | undefined) {
    if (!(date1 && date2)) return -1;

    const Date1 = new Date(date1.toString()).getTime();
    const Date2 = new Date(date2.toString()).getTime();

    return Math.abs(Date2 - Date1);
  }

  toTimeFormat(diffInMillis: number): string {
    const hours = Math.floor(diffInMillis / (1000 * 60 * 60));
    const minutes = Math.floor((diffInMillis % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffInMillis % (1000 * 60)) / 1000);
    const milliseconds = diffInMillis % 1000;

    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(
      seconds
    )}:${this.padZero(milliseconds, 3)}`;
  }

  padZero(num: number, size: number = 2): string {
    let numString = num.toString();
    while (numString.length < size) {
      numString = '0' + numString;
    }
    return numString;
  }

  addDiagramPopover(interactions: any[], notes: string[]) {
    var messageTextElements = document.getElementsByClassName('messageText');
    var messageNoteElements = document.getElementsByClassName('noteText');

    for (var i = 0; i < messageTextElements.length; i++) {
      var element = messageTextElements[i] as HTMLElement;
      element.style.cursor = 'pointer';
      if (interactions[i].hasException) element.style.fill = '#ff3333';

      element.addEventListener(
        'click',
        (
          (content) => (event) =>
            this.showPopover(event, content)
        )(interactions[i].content)
      );
    }

    for (var i = 0; i < messageNoteElements.length; i++) {
      var element = messageNoteElements[i] as HTMLElement;
      element.style.cursor = 'pointer';

      element.addEventListener(
        'click',
        (
          (content) => (event) =>
            this.showPopover(event, content)
        )(notes[i])
      );
    }
  }

  showPopover(event: MouseEvent, content: string) {
    this.showPopoverFlag = true;
    this.popoverX = event.clientX + 30;
    this.popoverY = event.clientY - 10;
    this.popoverContent = content;

    event.stopPropagation();
  }

  hidePopover() {
    this.showPopoverFlag = false;
  }

  handleOutsideClick(event: MouseEvent) {
    if (!this.isClickedElementInsidePopover(event.target as HTMLElement)) {
      this.hidePopover();
    }
  }

  isClickedElementInsidePopover(clickedElement: HTMLElement): boolean {
    const popoverElement = document.querySelector('app-popover') as HTMLElement;
    return popoverElement?.contains(clickedElement);
  }

  zoomHandler(event: WheelEvent) {
    if (event.shiftKey) {
      if (event.deltaY > 0) {
        this.panZoomAPI?.zoomOut();
      } else {
        this.panZoomAPI?.zoomIn();
      }
      event.preventDefault();
    }
  }

  createSequenceDiagramDefinition(
    lastLog: Log | null,
    currentLog: Log,
    interactions: SequenceDiagramInteraction[],
    isCallBack: boolean = false
  ): void {
    let content: string = 'No Content';

    if (!isCallBack) {
      if (currentLog?.input && currentLog.input.length > 0)
        content = JSON.stringify(currentLog?.input, null, 2);

      interactions.push({
        interactor: this.getControllerName(lastLog?.class ?? 'Initiator'),
        interactee: this.getControllerName(currentLog?.class),
        message: `${currentLog?.method}(${currentLog.inputTypes?.join(', ')})`,
        arrow: '->>+',
        note: null,
        timestamp: new Date(currentLog?.entryTime).getTime(),
        hasException: false,
        content: content,
      });

      currentLog.informations.forEach((info) => {
        interactions.push({
          interactor: this.getControllerName(currentLog?.class),
          interactee: null,
          arrow: null,
          message: null,
          note: info.logLevel!,
          timestamp: new Date(info.timestamp).getTime(),
          hasException: false,
          content: JSON.stringify(info, null, 2) ?? 'No Content',
        });
      });
    } else {
      if (currentLog?.output)
        content = JSON.stringify(currentLog?.output, null, 2);

      interactions.push({
        interactor: this.getControllerName(currentLog?.class),
        interactee: this.getControllerName(lastLog?.class ?? 'Initiator'),
        message: `${
          currentLog.hasException === true
            ? `throwed ${currentLog?.outputType}`
            : currentLog?.outputType ?? 'void'
        } `,
        arrow: '-->>-',
        note: null,
        timestamp: new Date(currentLog?.exitTime).getTime(),
        hasException: currentLog.hasException,
        content: content,
      });
    }

    if (
      !isCallBack &&
      currentLog.interactions &&
      currentLog.interactions.length > 0
    ) {
      currentLog.interactions.forEach((nextLog) => {
        this.createSequenceDiagramDefinition(currentLog, nextLog, interactions);
        this.createSequenceDiagramDefinition(
          currentLog,
          nextLog,
          interactions,
          true
        );
      });
    }
  }

  async initializeSequenceDiagram(): Promise<void> {
    if (!this.log) return;

    const interactions: SequenceDiagramInteraction[] = [];

    this.createSequenceDiagramDefinition(null, this.log, interactions);
    this.createSequenceDiagramDefinition(null, this.log, interactions, true);

    let graphDefinition = 'sequenceDiagram\nactor Initiator\n';

    interactions.sort((a, b) => a.timestamp - b.timestamp);

    interactions.forEach((interaction) => {
      if (!interaction.note) {
        graphDefinition += `${interaction.interactor}${interaction.arrow}${interaction.interactee}: ${interaction.message}\n`;
      } else {
        graphDefinition += `Note over ${interaction.interactor}:${interaction.note}\n`;
      }
    });

    mermaid.initialize({
      securityLevel: 'loose',
    });

    const { svg, bindFunctions } = await mermaid.render(
      'sequenceDiagramSvg',
      this.sequenceDiagramTheme + graphDefinition
    );

    const element: Element = this.sequenceDiagramElement?.nativeElement;

    element.innerHTML = svg;
    bindFunctions?.(element);

    const sequenceDiagramInteractionsContent = interactions
      .filter((interaction) => interaction.note === null)
      .map((interaction) => ({
        content: interaction.content,
        hasException: interaction.hasException,
      }));

    const sequenceDiagramNotesContent = interactions
      .filter((interaction) => interaction.note !== null)
      .map((interaction) => interaction.content);

    this.addDiagramPopover(
      sequenceDiagramInteractionsContent,
      sequenceDiagramNotesContent
    );
  }

  createMethodsExecutionTimeChart() {
    this.methodsExecutionTimeChart = new Chart('methodsExecutionTimeChart', {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        plugins: {
          title: {
            text: 'Methods Execution Time',
            display: true,
            font: {
              size: 14,
              style: 'oblique',
            },
            align: 'start',
          },
        },
      },
    });
  }

  async initializeMethodsExecutionTimeChart(): Promise<void> {
    if (!this.log) return;

    const executionTimes: ExecutionTime[] = [];

    this.calculateExecutionTimesForLog(this.log, executionTimes);

    this.methodsExecutionTimeChart?.data.datasets.splice(
      0,
      this.methodsExecutionTimeChart?.data.datasets.length
    );
    this.methodsExecutionTimeChart?.data.labels?.splice(
      0,
      this.methodsExecutionTimeChart?.data.labels?.length
    );

    this.methodsExecutionTimeChart?.data.labels?.push(
      ...executionTimes.map((x) => x.method)
    );

    this.methodsExecutionTimeChart?.data.datasets.push({
      label: 'ms',
      data: executionTimes.map((x) => x.value),
    });

    this.methodsExecutionTimeChart?.update();
  }

  calculateExecutionTimesForLog(
    log: Log,
    executionTimes: ExecutionTime[]
  ): void {
    executionTimes.push({
      method: log.method,
      value: this.getTimeDifference(log?.entryTime, log?.exitTime),
    });

    if (log.interactions && log.interactions.length > 0) {
      log.interactions.forEach((interaction) => {
        this.calculateExecutionTimesForLog(interaction, executionTimes);
      });
    }
  }
}
