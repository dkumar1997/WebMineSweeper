"use strict";
window.addEventListener("load", main);

let seconds = 0;
const countDownArea = document.getElementById("timer");
let intervalID = 0;
function incrementTime() {
  seconds+=1
  countDownArea.innerText = seconds;
}

let MSGame = (function() {
  // private constants
  const STATE_HIDDEN = "hidden";
  const STATE_SHOWN = "shown";
  const STATE_MARKED = "marked";

  function array2d(nrows, ncols, val) {
    const res = [];
    for (let row = 0; row < nrows; row++) {
      res[row] = [];
      for (let col = 0; col < ncols; col++) res[row][col] = val(row, col);
    }
    return res;
  }

  // returns random integer in range [min, max]
  function rndInt(min, max) {
    [min, max] = [Math.ceil(min), Math.floor(max)];
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  class _MSGame {
    constructor() {
      this.init(8, 10, 10); // easy
    }

    validCoord(row, col) {
      return row >= 0 && row < this.nrows && col >= 0 && col < this.ncols;
    }

    init(nrows, ncols, nmines) {
      this.nrows = nrows;
      this.ncols = ncols;
      this.nmines = nmines;
      this.nmarked = 0;
      this.nuncovered = 0;
      this.exploded = false;
      // create an array
      this.arr = array2d(nrows, ncols, () => ({
        mine: false,
        state: STATE_HIDDEN,
        count: 0
      }));
    }

    count(row, col) {
      const c = (r, c) =>
        this.validCoord(r, c) && this.arr[r][c].mine ? 1 : 0;
      let res = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) res += c(row + dr, col + dc);
      return res;
    }
    sprinkleMines(row, col) {
      // prepare a list of allowed coordinates for mine placement
      let allowed = [];
      for (let r = 0; r < this.nrows; r++) {
        for (let c = 0; c < this.ncols; c++) {
          if (Math.abs(row - r) > 2 || Math.abs(col - c) > 2)
            allowed.push([r, c]);
        }
      }
      this.nmines = Math.min(this.nmines, allowed.length);
      for (let i = 0; i < this.nmines; i++) {
        let j = rndInt(i, allowed.length - 1);
        [allowed[i], allowed[j]] = [allowed[j], allowed[i]];
        let [r, c] = allowed[i];
        this.arr[r][c].mine = true;
      }
      // erase any marks (in case user placed them) and update counts
      for (let r = 0; r < this.nrows; r++) {
        for (let c = 0; c < this.ncols; c++) {
          if (this.arr[r][c].state == STATE_MARKED)
            this.arr[r][c].state = STATE_HIDDEN;
          this.arr[r][c].count = this.count(r, c);
        }
      }
      let mines = [];
      let counts = [];
      for (let row = 0; row < this.nrows; row++) {
        let s = "";
        for (let col = 0; col < this.ncols; col++) {
          s += this.arr[row][col].mine ? "B" : ".";
        }
        s += "  |  ";
        for (let col = 0; col < this.ncols; col++) {
          s += this.arr[row][col].count.toString();
        }
        mines[row] = s;
      }
      console.log("Mines and counts after sprinkling:");
      console.log(mines.join("\n"), "\n");
    }
    // uncovers a cell at a given coordinate
    // this is the 'left-click' functionality
    uncover(row, col) {
      console.log("uncover", row, col);
      // if coordinates invalid, refuse this request
      if (!this.validCoord(row, col)) return false;
      // if this is the very first move, populate the mines, but make
      // sure the current cell does not get a mine
      if (this.nuncovered === 0) this.sprinkleMines(row, col);
      // if cell is not hidden, ignore this move
      if (this.arr[row][col].state !== STATE_HIDDEN) return false;
      // floodfill all 0-count cells
      const ff = (r, c) => {
        if (!this.validCoord(r, c)) return;
        if (this.arr[r][c].state !== STATE_HIDDEN) return;
        this.arr[r][c].state = STATE_SHOWN;
        this.nuncovered++;
        if (this.arr[r][c].count !== 0) return;
        ff(r - 1, c - 1);
        ff(r - 1, c);
        ff(r - 1, c + 1);
        ff(r, c - 1);
        ff(r, c + 1);
        ff(r + 1, c - 1);
        ff(r + 1, c);
        ff(r + 1, c + 1);
      };
      ff(row, col);
      // have we hit a mine?
      if (this.arr[row][col].mine) {
        this.exploded = true;
      }
      return true;
    }
    // puts a flag on a cell
    // this is the 'right-click' or 'long-tap' functionality
    mark(row, col) {
      console.log("mark", row, col);
      // if coordinates invalid, refuse this request
      if (!this.validCoord(row, col)) return false;
      // if cell already uncovered, refuse this
      console.log("marking previous state=", this.arr[row][col].state);
      if (this.arr[row][col].state === STATE_SHOWN) return false;
      // accept the move and flip the marked status
      this.nmarked += this.arr[row][col].state == STATE_MARKED ? -1 : 1;
      this.arr[row][col].state =
        this.arr[row][col].state == STATE_MARKED ? STATE_HIDDEN : STATE_MARKED;
      return true;
    }
    // returns array of strings representing the rendering of the board
    //      "H" = hidden cell - no bomb
    //      "F" = hidden cell with a mark / flag
    //      "M" = uncovered mine (game should be over now)
    // '0'..'9' = number of mines in adjacent cells
    getRendering() {
      const res = [];
      for (let row = 0; row < this.nrows; row++) {
        let s = "";
        for (let col = 0; col < this.ncols; col++) {
          let a = this.arr[row][col];
          if (this.exploded && a.mine) s += "M";
          else if (a.state === STATE_HIDDEN) s += "H";
          else if (a.state === STATE_MARKED) s += "F";
          else if (a.mine) s += "M";
          else s += a.count.toString();
        }
        res[row] = s;
      }
      return res;
    }
    getStatus() {
      let done =
        this.exploded ||
        this.nuncovered === this.nrows * this.ncols - this.nmines;
      return {
        done: done,
        exploded: this.exploded,
        nrows: this.nrows,
        ncols: this.ncols,
        nmarked: this.nmarked,
        nuncovered: this.nuncovered,
        nmines: this.nmines
      };
    }
  }

  return _MSGame;
})();

function prepare_dom(game) {
  const grid = document.querySelector(".grid");
  const nCards = 14 * 18; // max grid size
  for (let i = 0; i < nCards; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-cardInd", i);
    card.addEventListener("click", () => {
      card_click_cb(game, i);
    });
    card.addEventListener("contextmenu", () => {
      tapholdHandler(game, card, i);
    });

    grid.appendChild(card);
  }
}
function render(s) {
  console.log(s, "this is in render");
  const grid = document.querySelector(".grid");
  grid.style.gridTemplateColumns = `repeat(${s.ncols}, 1fr)`;
  
  for (let i = 0; i < grid.children.length; i++) {
    const card = grid.children[i];
    const ind = Number(card.getAttribute("data-cardInd"));
    if (ind >= s.nrows * s.ncols) {
      card.style.display = "none";
    } else {
      card.style.display = "block";
      if (s.onoff[ind] == "H") {
        card.classList.add("hidden");
      } else if (s.onoff[ind] == "F") {
        card.classList.add("flag");
      } else if (s.onoff[ind] == "M") {
        card.classList.add("bomb");
      } else {
        card.innerHTML = s.onoff[ind];
        card.classList.add("number");
      }
    }
  }
  document.querySelectorAll(".flagCount").forEach(e => {
    e.textContent = String(s.nmines - s.nmarked);
  });
}
function button_cb(rows, cols, mines) {
  clearInterval(intervalID);
  seconds = 0;
  countDownArea.innerText=seconds;
  let game = new MSGame();
  game.init(rows, cols, mines);
  let state = game.getStatus();
  state.onoff = flattenArray(game.getRendering());
  document.querySelectorAll(".card").forEach(e => e.parentNode.removeChild(e));
  prepare_dom(game);
  render(state);
}
function flattenArray(arr) {
  let finalArray = [];
  let perArray = [];
  for (let i = 0; i < arr.length; i++) {
    finalArray.push(arr[i].split(""));
  }
  for (let i = 0; i < finalArray.length; i++) {
    for (let j = 0; j < finalArray[i].length; j++) {
      perArray.push(finalArray[i][j]);
    }
  }
  return perArray;
}
function card_click_cb(game, ind) {
  let s = game.getStatus();
  const col = ind % s.ncols;
  const row = Math.floor(ind / s.ncols);
  
  
  let initialMoveCheck = false;
  if(s.nuncovered == 0){
    initialMoveCheck = true;
  }
  else{
    initialMoveCheck = false;
  }

  game.uncover(row, col);
  s = game.getStatus();
  s.onoff = flattenArray(game.getRendering());
  

  if(initialMoveCheck){
    game.nmarked = 0;
    s.nmarked = 0;
    document.querySelectorAll(".card").forEach(card=>card.classList.remove("flag"));
    intervalID = setInterval(incrementTime, 1000);
  }
  render(s);
  // check if we won and activate overlay if we did
  if (s.done == true && s.exploded == false) {
    document.querySelector("#overlay").classList.toggle("active");
    document.querySelector(".glow").innerHTML = "Congratulations, you won!!!";
    clearInterval(intervalID);
  } else if (s.done == true && s.exploded == true) {
    document.querySelector("#overlay").classList.toggle("active");
    document.querySelector(".glow").innerHTML =
      "Sorry, you lost. You hit a bomb";
    clearInterval(intervalID);
  }
}
function tapholdHandler(game, card_div, ind) {
  let s = game.getStatus();
  const col = ind % s.ncols;
  const row = Math.floor(ind / s.ncols);
  card_div.classList.toggle("flag");
  
  game.mark(row, col);
  s = game.getStatus();
  console.log(s, "this is in tap and hold");
  s.onoff = flattenArray(game.getRendering());
  render(s);
}



function main() {
  document.querySelector("#overlay").addEventListener("click", () => {
    document.querySelector("#overlay").classList.remove("active");
    button_cb(8, 10, 10);
  });
  document.querySelectorAll(".menuButton").forEach(button => {
    let rows, cols, mines;
    [rows, cols, mines, name] = button
      .getAttribute("data-size")
      .split("x")
      .map(s => Number(s));
    button.innerHTML = button.getAttribute("name");
    button.addEventListener("click", button_cb.bind(null, rows, cols, mines));
  });

  

  // got to ask what does the bind function do?
  button_cb(8, 10, 10);
  
}
