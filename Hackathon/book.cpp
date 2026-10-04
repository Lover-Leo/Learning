#include <iostream>
#include <string>
#include <vector>
#include <limits>
#include "book.h"
#define NOMINMAX
#include <windows.h>
book::book(const std::string& newtitle,const std::string& newid,const std::string& newauther):
title(newtitle),id(newid),auther(newauther),status(borrowstatus::available)
{

}
const std::string& book::getid() const
{
    return id;
}
const std::string& book::gettitle() const
{
    return title;
}
borrowstatus book::getstatus() const
{
    return status;
}
bool book::borrow()
{
    if(status == borrowstatus::borrowed)
    {
        std::cout << "未能成功借阅该图书\n";
        return false;
    }
    else
    {
        std::cout << "已成功借阅该图书\n";
        status = borrowstatus::borrowed;
        return true;
    }
}
void book::showinfo() const
{
    std::cout << "书名:" << title << "\n";
    std::cout << "编号:" << id << "\n";
    std::cout << "作者:" << auther << "\n";
    std::cout << "是否借出:" ;
    if(status == borrowstatus::borrowed)
    {
        std::cout << "已借出\n";
    }
    else
    {
        std::cout << "未借出\n";
    }
    std::cout << "====================\n";
}
const std::string& book::getauther() const
{
    return auther;
}
bool book::returnbook()
{
    if(status == borrowstatus::available)
    {
        std::cout << "该图书未借出\n";
        return false;
    }
    else
    {
        std::cout << "已成功归还该图书\n";
        status = borrowstatus::available;
        return true;
    }
}