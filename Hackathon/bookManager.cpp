#include<iostream>
#include<string>
#include<vector>
#include<windows.h>
enum class borrowstatus
{
    available,
    borrowed
};
class book
{
    private:
        std::string id;
        std::string title;
        std::string auther;
        borrowstatus status;
    public:
        book(const std::string& newtitle,const std::string& newid,const std::string& newauther);
        const std::string& getid() const;
        const std::string& gettitle() const;
        const std::string& getauther() const;
        borrowstatus getstatus() const; 
        void showinfo() const;
};
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
void addbook(std::vector<book>& books)
{
    std::string newid;
    std::string newtitle;
    std::string newauther;
    std::cout << "编号:";
    std::getline(std::cin >> std::ws,newid);
    for(const auto& bo: books)
    {
        if(newid == bo.getid())
        {
            std::cout << "您的图书编号与其他图书编号重复";
            return;
        }
    }
    std::cout << "书名:";
    std::getline(std::cin,newtitle);
    std::cout << "作者:";
    std::getline(std::cin,newauther);
    books.emplace_back(newtitle,newid,newauther);
}
void showbook(const std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有添加图书";
        return;
    }
    for(const auto& bo: books)
    {
        bo.showinfo();
    }
}
void findbook(const std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书";
        return;
    }
    std::string newid;
    std::getline(std::cin,newid);
    for(const auto& bo:books)
    {
        if (newid == bo.getid())
        {
            bo.showinfo();
            return;
        }
        
    }
    std::cout << "系统内没有找到该图书";
}
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    std::vector<book> books;
    int choice;
    do
    {
        std::cout << "====图书馆管理系统====\n";
        std::cout << "1.添加图书\n";
        std::cout << "2.显示全部图书\n";
        std::cout << "3.根据编号查找图书\n";
        std::cout << "0.退出系统\n";
        std::cin >> choice;
        switch(choice)
        {
            case 1:
                addbook(books);
                break;
            case 2:
                showbook(books);
                break;
            case 3:
                findbook(books);
                break;
            case 0:
                std::cout << "您已成功退出系统";
                break;
            default:
                std::cout << "无效输入";
                break;
        }
    }while(choice != 0);
    return 0;
}