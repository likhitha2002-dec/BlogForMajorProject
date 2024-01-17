import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css'; 


const AccessControl = () => {
  return (
    <div className="container mt-5">
      <h1>Access Control in Solidity Smart Contracts</h1>

      <p className="lead">
        Software and systems that contain access control vulnerabilities allow unauthorized users
        to access or modify data or functions through security flaws. A security control system
        determines who and what may access specific resources or perform certain actions by
        establishing rules and mechanisms. When these rules and mechanisms are not properly
        implemented, unauthorized users may bypass them and gain access to sensitive information or
        functionalities as a result of an access control vulnerability.
      </p>

      <p className="lead">
        It is possible for attackers to steal sensitive data, manipulate information, or disrupt
        the functionality of a system or application due to access control vulnerabilities. In
        order to prevent these vulnerabilities from occurring, developers must carefully design and
        implement access control mechanisms in their software and systems.
      </p>

      <h2>Access Control Vulnerabilities in Solidity</h2>

      <p className="lead">
        An access control vulnerability in a Solidity smart contract is a type of security flaw
        that lets unauthorized users access or modify the contract’s data or functions. The Ethereum
        blockchain uses Solidity for smart contracts. If the contract’s code does not properly
        restrict access to its data or functions according to the user’s permission level, access
        control vulnerabilities can occur.
      </p>

      <h2>Solidity Access Control Vulnerability Example</h2>

      <p className="lead">
        An example would be a contract allowing users to deposit and withdraw ether (the native
        currency of the Ethereum blockchain). It might have a public function called “withdraw”
        that lets users withdraw ether. The attacker could withdraw ether from the contract without
        the user’s permission if the contract does not check the user’s permission level before
        executing the function. Since the contract does not control access to its data and functions
        properly, this is an access control vulnerability.
      </p>

      <pre>
        <code>
          {`
            pragma solidity ^0.5.0;
            
            contract Bank {
                // The contract's balance of ether
                uint256 public balance;
            
                // The owner of the contract
                address public owner;
            
                // A mapping that stores the balances of each user
                mapping (address => uint256) public userBalances;
            
                constructor() public {
                    // Set the contract owner
                    owner = msg.sender;
                }
            
                // Allows users to deposit ether into their account
                function deposit(uint256 amount) public {
                    // Update the user's balance
                    userBalances[msg.sender] += amount;
            
                    // Update the contract's balance
                    balance += amount;
                }
            
                // Allows users to withdraw ether from their account
                function withdraw(uint256 amount) public {
                    // Check if the user is the owner of the contract
                    require(msg.sender == owner, "Only the owner can withdraw");
            
                    // Check if the user has sufficient balance
                    require(userBalances[msg.sender] >= amount, "Insufficient balance");
            
                    // Update the user's balance
                    userBalances[msg.sender] -= amount;
            
                    // Update the contract's balance
                    balance -= amount;
                }
            }
          `}
        </code>
      </pre>

      <h2>Fixing the Vulnerability</h2>

      <p className="lead">
        To fix this vulnerability, the contract should check the user’s permission level before
        executing the withdraw function. For example, the contract should define a variable that
        stores the address of the owner and then check this variable against msg.sender in the
        withdraw function:
      </p>

      <pre>
        <code>
          {`
            pragma solidity ^0.5.0;
            
            contract Bank {
                // The contract's balance of ether
                uint256 public balance;
            
                // The owner of the contract
                address public owner;
            
                // A mapping that stores the balances of each user
                mapping (address => uint256) public userBalances;
            
                constructor() public {
                    // Set the contract owner
                    owner = msg.sender;
                }
            
                // Allows users to deposit ether into their account
                function deposit(uint256 amount) public {
                    // Update the user's balance
                    userBalances[msg.sender] += amount;
            
                    // Update the contract's balance
                    balance += amount;
                }
            
                // Allows users to withdraw ether from their account
                function withdraw(uint256 amount) public {
                    // Check if the user is the owner of the contract
                    require(msg.sender == owner, "Only the owner can withdraw");
            
                    // Check if the user has sufficient balance
                    require(userBalances[msg.sender] >= amount, "Insufficient balance");
            
                    // Update the user's balance
                    userBalances[msg.sender] -= amount;
            
                    // Update the contract's balance
                    balance -= amount;
                }
            }
          `}
        </code>
      </pre>

      <p className="lead">
        In this updated version of the contract, the owner variable stores the address of the
        contract owner, and the withdraw function checks this variable against msg.sender before
        allowing the withdrawal to proceed. This prevents attackers from calling the withdraw
        function and withdrawing ether from the contract without the user's permission.
      </p>

      <h2>Summary</h2>

      <p className="lead">
        A smart contract’s security can be seriously compromised by access control vulnerabilities.
        An attacker could steal funds, manipulate data, or disrupt the contract. To ensure that
        their contracts are not vulnerable to access control attacks, contract developers should
        carefully design and test them.
      </p>
    </div>
  );
};

export default AccessControl;

