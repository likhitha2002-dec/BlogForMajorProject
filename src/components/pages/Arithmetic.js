import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const Arithmetic = () => {
  return (
    <div className="container mt-5">
      <h1>Arithmetic Over/Under Flows in Ethereum Smart Contracts</h1>

      <p className="lead">
        The Ethereum Virtual Machine (EVM) specifies fixed-size data types for integers. This means
        that an integer variable only has a certain range of numbers it can represent. A uint8, for
        example, can only store numbers in the range [0,255]. Trying to store 256 into a uint8 will
        result in 0. If care is not taken, variables in Solidity can be exploited if user input is
        unchecked and calculations are performed, resulting in numbers that lie outside the range
        of the data type that stores them.
      </p>

      <h2>The Vulnerability</h2>

      <p className="lead">
        An over/underflow occurs when an operation is performed that requires a fixed-size variable
        to store a number (or piece of data) that is outside the range of the variable's data type.
        For example, subtracting 1 from a uint8 (unsigned integer of 8 bits, i.e. only positive)
        variable that stores 0 as its value, will result in the number 255. This is an underflow.
        We have assigned a number below the range of the uint8, the result wraps around and gives
        the largest number a uint8 can store. Similarly, adding 2^8=256 to a uint8 will leave the
        variable unchanged as we have wrapped around the entire length of the uint.
      </p>

      <p className="lead">
        Adding numbers larger than the data type's range is called an overflow. For clarity, adding
        257 to a uint8 that currently has a zero value will result in the number 1. It's sometimes
        instructive to think of fixed type variables being cyclic, where we start again from zero
        if we add numbers above the largest possible stored number, and vice-versa for zero (where
        we start counting down from the largest number the more we subtract from 0).
      </p>

      <p className="lead">
        These kinds of numerical caveats allow attackers to misuse code and create unexpected logic
        flows. For example, consider the time locking contract below.
      </p>

      <pre>
        <code>
          {`
contract TimeLock {

    mapping(address => uint) public balances;
    mapping(address => uint) public lockTime;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
        lockTime[msg.sender] = now + 1 weeks;
    }

    function increaseLockTime(uint _secondsToIncrease) public {
        lockTime[msg.sender] += _secondsToIncrease;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0);
        require(now > lockTime[msg.sender]);
        uint transferValue = balances[msg.sender];
        balances[msg.sender] = 0;
        msg.sender.transfer(transferValue);
    }
}
          `}
        </code>
      </pre>

      <p className="lead">
        This contract is designed to act like a time vault, where users can deposit ether into the
        contract and it will be locked there for at least a week. The user may extend the wait time
        to longer than 1 week if they choose, but once deposited, the user can be sure their ether
        is locked in safely for at least a week. Or can they?...
      </p>

      <p className="lead">
        In the event a user is forced to hand over their private key (think hostage situation) a
        contract such as this may be handy to ensure ether is unobtainable in short periods of time.
        If a user had locked in 100 ether in this contract and handed their keys over to an attacker,
        an attacker could use an overflow to receive the ether, regardless of the lockTime.
      </p>

      <p className="lead">
        The attacker could determine the current lockTime for the address they now hold the key for
        (it's a public variable). Let's call this userLockTime. They could then call the
        increaseLockTime function and pass as an argument the number 2^256 - userLockTime. This
        number would be added to the current userLockTime and cause an overflow, resetting
        lockTime[msg.sender] to 0. The attacker could then simply call the withdraw function to
        obtain their reward.
      </p>

      <p className="lead">
        Let's look at another example, this one from the Ethernaut Challenges.
      </p>

      <p className="lead">
        SPOILER ALERT: If you've not yet done the Ethernaut challenges, this gives a solution to one
        of the levels.
      </p>

      <pre>
        <code>
          {`
pragma solidity ^0.4.18;

contract Token {

  mapping(address => uint) balances;
  uint public totalSupply;

  function Token(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] - _value >= 0);
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
          `}
        </code>
      </pre>

      <p className="lead">
        This is a simple token contract which employs a transfer() function, allowing participants
        to move their tokens around. The flaw comes in the transfer() function. The require
        statement on line [13] can be bypassed using an underflow. Consider a user that has no
        balance. They could call the transfer() function with any non-zero _value and pass the
        require statement on line [13]. This is because balances[msg.sender] is zero (and a uint256)
        so subtracting any positive amount (excluding 2^256) will result in a positive number due to
        the underflow we described above. This is also true for line [14], where our balance will be
        credited with a positive number. Thus, in this example, we have achieved free tokens due to
        an underflow vulnerability.
      </p>

      <h2>Preventative Techniques</h2>

      <p className="lead">
        The (currently) conventional technique to guard against under/overflow vulnerabilities is to
        use or build mathematical libraries which replace the standard math operators; addition,
        subtraction and multiplication (division is excluded as it doesn't cause over/under flows
        and the EVM reverts on division by 0).
      </p>

      <p className="lead">
        OppenZepplin have done a great job in building and auditing secure libraries which can be
        leveraged by the Ethereum community. In particular, their Safe Math Library is a reference
        or library to use to avoid under/overflow vulnerabilities.
      </p>

      <h2>Fixing the Vulnerability with SafeMath</h2>

      <pre>
        <code>
          {`
library SafeMath {

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

contract TimeLock {
    using SafeMath for uint; // use the library for uint type
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockTime;

    function deposit() public payable {
        balances[msg.sender] = balances[msg.sender].add(msg.value);
        lockTime[msg.sender] = now.add(1 weeks);
    }

    function increaseLockTime(uint256 _secondsToIncrease) public {
        lockTime[msg.sender] = lockTime[msg.sender].add(_secondsToIncrease);
    }

    function withdraw() public {
        require(balances[msg.sender] > 0);
        require(now > lockTime[msg.sender]);
        uint transferValue = balances[msg.sender];
        balances[msg.sender] = 0;
        msg.sender.transfer(transferValue);
    }
}
          `}
        </code>
      </pre>

      <p className="lead">
        Notice that all standard math operations have been replaced by those defined in the SafeMath
        library. The TimeLock contract no longer performs any operation which is capable of doing
        an under/overflow.
      </p>
    </div>
  );
};

export default Arithmetic;
