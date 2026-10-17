# Page snapshot

```yaml
- main [ref=e2]:
  - heading "Phone speed" [level=1] [ref=e3]
  - paragraph [ref=e4]: Run the 30 slowest toys on this device. Each opens at 390×844 on the phone tier. Keep this tab visible and your phone cool. Each toy uses fresh preferences; your saved settings are preserved. Nothing is uploaded or saved automatically.
  - generic [ref=e5]:
    - button "Start run" [ref=e6] [cursor=pointer]
    - button "Stop" [disabled] [ref=e7]
    - button "Copy table" [ref=e8] [cursor=pointer]
    - button "Save JSON" [ref=e9] [cursor=pointer]
  - status [ref=e10]: Complete. 1 toys checked; 1 errors. Copy the table or save the local JSON.
  - generic "Toy being measured"
  - generic "Results, scroll horizontally for all columns" [ref=e11]:
    - table [ref=e12]:
      - rowgroup [ref=e13]:
        - row "Toy First view ms Idle median / p95 ms Tap median / p95 ms JS heap MiB Transfer MiB Cache hits" [ref=e14]:
          - cell "Toy" [ref=e15]
          - cell "First view ms" [ref=e16]
          - cell "Idle median / p95 ms" [ref=e17]
          - cell "Tap median / p95 ms" [ref=e18]
          - cell "JS heap MiB" [ref=e19]
          - cell "Transfer MiB" [ref=e20]
          - cell "Cache hits" [ref=e21]
      - rowgroup [ref=e22]:
        - 'row "Tennis ball Error: ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; Uncaught Error: Deliberate application failure" [ref=e23]':
          - cell "Tennis ball" [ref=e24]
          - 'cell "Error: ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; Uncaught Error: Deliberate application failure" [ref=e25]'
          - cell [ref=e26]
          - cell [ref=e27]
          - cell [ref=e28]
          - cell [ref=e29]
          - cell [ref=e30]
  - text: Copyable table
  - textbox "Copyable table" [ref=e31]:
    - /placeholder: Results appear here.
    - text: "Toy First view ms Idle median / p95 ms Tap median / p95 ms JS heap MiB Transfer MiB Cache hits Tennis ball Error: ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; ResizeObserver loop completed with undelivered notifications.; Uncaught Error: Deliberate application failure"
  - group [ref=e32]:
    - generic "Method and limits" [ref=e33] [cursor=pointer]
```