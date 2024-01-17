import './App.css';
import Navbar from './components/Navbar'
import { Routes,Route } from 'react-router-dom';
import Home from './components/pages/Home'
import AccessControl from './components/pages/AccessControl';
import Arithmetic from './components/pages/Arithmetic';
import Others from './components/pages/Others';
import Reentrancy from './components/pages/Reentrancy';
import Uncheckedcalls from './components/pages/Uncheckedcalls';

function App() {
  return (
   <div className='App'>
    <Navbar />
    <Routes>
      <Route path='/' element={<Home />}/>
      <Route path='/access' element={<AccessControl />} />
      <Route path='/arithmetic' element={<Arithmetic />} />
      <Route path='/reentrancy' element={<Reentrancy />} />
      <Route path='/unchecked' element={<Uncheckedcalls />} />
      <Route path='/others' element={<Others />} />
    </Routes>
   </div>
  );
}

export default App;
