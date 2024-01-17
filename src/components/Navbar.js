import React, { useState } from "react";

import "./Navbar.css";
import { Link, NavLink } from "react-router-dom";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav>
      <Link to="/" className="title">
        Website
      </Link>
      <div className="menu" onClick={() => setMenuOpen(!menuOpen)}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <ul className={menuOpen ? "open" : ""}>
        <li>
          <NavLink to="/access">AccessControl</NavLink>
        </li>
        <li>
          <NavLink to="/arithmetic">Arithmetic</NavLink>
        </li>
        <li>
          <NavLink to="/reentrancy">Reentrancy</NavLink>
        </li>
        <li>
          <NavLink to="/unchecked">Uncheckedcalls</NavLink>
        </li>
        <li>
          <NavLink to="/others">Others</NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar