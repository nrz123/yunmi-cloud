import './App.css';
import { HashRouter, Routes , Route} from 'react-router-dom'
import Home from './home.js'
import Update from './update.js'
import Set from './set.js'
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route exact path="/" element={<Home/>}/>
        <Route path="/update" element={<Update/>}/>
        <Route path="/set" element={<Set/>}/>
        <Route path="/home" element={<Home/>}/>
      </Routes>
    </HashRouter>
  )
}
export default App