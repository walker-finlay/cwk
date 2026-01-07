# cwk

## reference
base url: https://www.nytimes.com

### GET puzzle json
`/svc/crosswords/v6/puzzle/daily/[yyyy-MM-dd].json`

### SVG
Find circled cells using puzzle `.body[0].SVG.children[1].children[i]`
```json
"body": [
  {
    // ...
    "SVG": {
      // ...
      "children": [
        {
          // ...
          // This one contains lines, polygons, circles, not sure what for yet
        },
        {
          // This one contains cells
          // ...
          "children": [
            // ...
            // Exmaple of a cell with a circle 
            {
              "name": "g",
              "attributes": [/* ... */],
              "children": [
                {/* ... */},
                {
                  "name": "circle",
                  "attributes": [/* ... */]
                },
                {/* ... */}
              ]
            }
            // ...
          ]
        },
        {
          // ...
          // This one contains the grid
        }
      ]
    }
  }
]
```